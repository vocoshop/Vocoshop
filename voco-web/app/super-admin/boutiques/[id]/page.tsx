'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;
const fmt = (n: number) => n.toLocaleString('fr-FR');
const sColor = (s?: string) => ({ active: '#22c55e', trial: '#eab308', grace: '#3b82f6', expired: '#ef4444', unused: '#71717a' })[s || ''] || '#71717a';
const sLabel = (s?: string) => ({ active: 'Actif', trial: 'Trial', grace: 'Grace', expired: 'Expiré', unused: 'Inactif' })[s || ''] || 'En attente';

function daysLeft(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

function fmtDate(iso?: string | null) {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function BoutiqueDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [store, setStore] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('info');
  const [showAddDays, setShowAddDays] = useState(false);
  const [daysToAdd, setDaysToAdd] = useState(7);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error') => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) { router.push('/admin/login'); return; }
    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const [sr, lr] = await Promise.all([
          fetch(`${API}/admin/stores/${id}`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/logs?limit=30`, { headers: h }).catch(() => null),
        ]);
        if (sr?.ok) {
          const d = await sr.json();
          if (d.storeId || d._id) setStore(d);
        }
        if (lr?.ok) {
          const ld = await lr.json();
          setLogs(ld.logs || []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const handleAddDays = async () => {
    setActionLoading(true);
    const t = localStorage.getItem('adminToken');
    if (!t) { setActionLoading(false); return; }
    try {
      const r = await fetch(`${API}/admin/stores/${store.storeId}/extend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: daysToAdd }),
      }).catch(() => null);
      if (r?.ok) {
        const currentPaidUntil = store.paidUntil ? new Date(store.paidUntil) : new Date();
        const newPaidUntil = new Date(currentPaidUntil);
        newPaidUntil.setDate(newPaidUntil.getDate() + daysToAdd);
        setStore({ ...store, paidUntil: newPaidUntil.toISOString(), subscriptionStatus: 'active' });
        setShowAddDays(false);
        showToast(`+${daysToAdd} jours ajoutés avec succès`, 'success');
      } else {
        showToast('Erreur lors de l\'ajout de jours', 'error');
      }
    } catch { showToast('Erreur de connexion', 'error'); }
    setActionLoading(false);
  };

  const handleSuspend = async () => {
    if (!confirm('Suspendre cette boutique ? Elle perdra accès.')) return;
    setActionLoading(true);
    const t = localStorage.getItem('adminToken');
    try {
      const r = await fetch(`${API}/admin/stores/${store.storeId}/suspend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      }).catch(() => null);
      if (r?.ok) {
        setStore({ ...store, subscriptionStatus: 'expired' });
        showToast('Boutique suspendue', 'success');
      } else {
        showToast('Erreur lors de la suspension', 'error');
      }
    } catch { showToast('Erreur de connexion', 'error'); }
    setActionLoading(false);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}><div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;
  if (!store) return <div style={{ textAlign: 'center', padding: 60, color: '#71717a' }}>Boutique non trouvée</div>;

  const s = store;
  const daysLeftVal = daysLeft(s.paidUntil || s.trialEnd || s.graceUntil);
  const daysSinceActive = s.lastActiveAt ? Math.floor((Date.now() - new Date(s.lastActiveAt).getTime()) / 86400000) : null;

  const getHealthScore = () => {
    let score = 100;
    let details: { label: string; value: number; max: number; color: string }[] = [];

    const subScore = (() => {
      if (s.subscriptionStatus === 'active') return 30;
      if (s.subscriptionStatus === 'grace') return 15;
      if (s.subscriptionStatus === 'trial') return 20;
      return 0;
    })();
    details.push({ label: 'Abonnement', value: subScore, max: 30, color: subScore >= 20 ? '#22c55e' : subScore >= 10 ? '#eab308' : '#ef4444' });

    const daysScore = (() => {
      if (daysLeftVal === null) return 10;
      if (daysLeftVal <= 0) return 0;
      if (daysLeftVal <= 3) return 5;
      if (daysLeftVal <= 7) return 10;
      if (daysLeftVal <= 30) return 20;
      return 25;
    })();
    details.push({ label: 'Jours restants', value: daysScore, max: 25, color: daysScore >= 15 ? '#22c55e' : daysScore >= 5 ? '#eab308' : '#ef4444' });

    const activityScore = (() => {
      if (daysSinceActive === null) return 0;
      if (daysSinceActive === 0) return 25;
      if (daysSinceActive <= 3) return 20;
      if (daysSinceActive <= 7) return 15;
      if (daysSinceActive <= 30) return 10;
      return 3;
    })();
    details.push({ label: 'Activite recente', value: activityScore, max: 25, color: activityScore >= 15 ? '#22c55e' : activityScore >= 5 ? '#eab308' : '#ef4444' });

    const onboardingScore = s.isOnboarded ? 20 : 10;
    details.push({ label: 'Onboarding', value: onboardingScore, max: 20, color: s.isOnboarded ? '#22c55e' : '#eab308' });

    const referralScore = (() => {
      const paid = s.paidReferrals || 0;
      if (paid >= 3) return 20;
      if (paid >= 1) return 15;
      return 10;
    })();
    details.push({ label: 'Parrainages payants', value: referralScore, max: 20, color: referralScore >= 15 ? '#22c55e' : '#eab308' });

    score = details.reduce((sum, d) => sum + d.value, 0);
    return { score, details };
  };

  const health = getHealthScore();
  const healthColor = health.score >= 70 ? '#22c55e' : health.score >= 40 ? '#eab308' : '#ef4444';

  const infoCards = [
    { label: 'Nom boutique', value: s.storeName },
    { label: 'ID Boutique', value: s.storeId?.slice(-12) || '-' },
    { label: 'Shop ID', value: s.shopId || '-' },
    { label: 'Téléphone', value: s.phone || '-' },
    { label: 'Ville', value: s.city || '-' },
    { label: 'Agent', value: s.agentCode || '-', color: '#a855f7' },
    { label: 'Abonné le', value: fmtDate(s.trialEnd || s.installedAt) },
    { label: 'Expire le', value: fmtDate(s.paidUntil || s.trialEnd || s.graceUntil) },
    { label: 'Jours restants', value: daysLeftVal !== null ? (daysLeftVal <= 0 ? 'Expiré' : `${daysLeftVal}j`) : '-', color: daysLeftVal !== null && daysLeftVal <= 3 ? '#ef4444' : daysLeftVal !== null && daysLeftVal <= 7 ? '#eab308' : undefined },
    { label: 'Dernière activité', value: daysSinceActive !== null ? (daysSinceActive === 0 ? "Aujourd'hui" : `Il y a ${daysSinceActive}j`) : 'Jamais' },
    { label: 'Renouvellement auto', value: s.autoRenew ? '✅ Activé' : '❌ Désactivé' },
    { label: 'Cycles facturés', value: s.billingCycleCount ? `${s.billingCycleCount}` : '0' },
    { label: 'Onboarding', value: s.isOnboarded ? '✅ Complété' : '⏳ En cours' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {toast && (
        <div style={{
          position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10,
          background: toast.type === 'success' ? '#22c55e20' : '#ef444420',
          border: `1px solid ${toast.type === 'success' ? '#22c55e' : '#ef4444'}`,
          color: toast.type === 'success' ? '#22c55e' : '#ef4444',
          fontSize: 13, fontWeight: 500, backdropFilter: 'blur(8px)',
        }}>{toast.msg}</div>
      )}

      <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Retour</button>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24 }}>🏪</div>
          <div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>{s.storeName}</h1>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${sColor(s.subscriptionStatus)}20`, color: sColor(s.subscriptionStatus) }}>{sLabel(s.subscriptionStatus)}</span>
              <span style={{ fontSize: 12, color: '#52525b' }}>ID: {s.storeId?.slice(-8)}</span>
              {s.city && <span style={{ fontSize: 12, color: '#52525b' }}>· {s.city}</span>}
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <button onClick={handleSuspend} disabled={actionLoading || s.subscriptionStatus === 'expired'} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          background: '#eab30810', border: '1px solid #eab30830', borderRadius: 8,
          color: '#eab308', cursor: actionLoading || s.subscriptionStatus === 'expired' ? 'not-allowed' : 'pointer',
          fontSize: 12, fontWeight: 500, opacity: actionLoading || s.subscriptionStatus === 'expired' ? 0.5 : 1,
        }}>
          ⏸️ Suspendre
        </button>
        <button onClick={() => setShowAddDays(true)} disabled={actionLoading} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          background: '#22c55e10', border: '1px solid #22c55e30', borderRadius: 8,
          color: '#22c55e', cursor: actionLoading ? 'not-allowed' : 'pointer', fontSize: 12, fontWeight: 500, opacity: actionLoading ? 0.5 : 1,
        }}>
          ➕ Ajouter jours
        </button>
        <a href={`tel:${s.phone}`} style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px',
          background: '#a855f710', border: '1px solid #a855f730', borderRadius: 8,
          color: '#a855f7', fontSize: 12, fontWeight: 500, textDecoration: 'none',
        }}>
          📞 Contacter
        </a>
      </div>

      <div style={{ background: '#18181b', borderRadius: 12, padding: 16, border: '1px solid #27272a', marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 20 }}>💚</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Score sante</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {health.details.map(d => (
                <div key={d.label} style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: '#52525b', marginBottom: 2 }}>{d.label}</div>
                  <div style={{ width: 32, height: 4, background: '#27272a', borderRadius: 2, overflow: 'hidden' }}>
                    <div style={{ width: `${(d.value / d.max) * 100}%`, height: '100%', background: d.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div style={{ width: 48, height: 48, borderRadius: '50%', border: `3px solid ${healthColor}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <span style={{ fontSize: 14, fontWeight: 700, color: healthColor }}>{health.score}</span>
            </div>
          </div>
        </div>
        <div style={{ fontSize: 11, color: '#71717a' }}>
          <span style={{ color: healthColor, fontWeight: 500 }}>
            {health.score >= 70 ? 'En bonne sante' : health.score >= 40 ? 'Attention requise' : 'Intervention needed'}
          </span>
          {' '}· Abonnement {s.subscriptionStatus === 'active' ? 'actif' : s.subscriptionStatus === 'trial' ? 'trial' : s.subscriptionStatus === 'grace' ? 'grace' : 'expiré'} · Active {daysSinceActive !== null ? (daysSinceActive === 0 ? "aujourd'hui" : `il y a ${daysSinceActive}j`) : 'jamais'}
        </div>
      </div>

      {showAddDays && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowAddDays(false)}>
          <div style={{ background: '#18181b', borderRadius: 16, width: '100%', maxWidth: 380, padding: 24, border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Ajouter des jours</h3>
            <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>Expire actuellement: {fmtDate(s.paidUntil || s.trialEnd)}</p>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[7, 15, 30].map(d => (
                <button key={d} onClick={() => setDaysToAdd(d)} style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  background: daysToAdd === d ? '#a855f7' : '#27272a',
                  border: 'none', color: '#fff', cursor: 'pointer', fontSize: 14, fontWeight: 600,
                }}>+{d}j</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowAddDays(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#27272a', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={handleAddDays} disabled={actionLoading} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#a855f7', border: 'none', color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1, fontSize: 13, fontWeight: 600 }}>
                {actionLoading ? '...' : `Ajouter +${daysToAdd}j`}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #27272a' }}>
        {['info', 'activité', 'logs'].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '10px 18px', background: 'transparent', border: 'none',
            color: tab === t ? '#a855f7' : '#71717a', cursor: 'pointer', fontSize: 13,
            fontWeight: tab === t ? 600 : 400, borderBottom: tab === t ? '2px solid #a855f7' : '2px solid transparent', marginBottom: -1,
          }}>{t === 'info' ? 'Informations' : t === 'activité' ? 'Activité' : 'Logs'}</button>
        ))}
      </div>

      {tab === 'info' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 }}>
          {infoCards.map(f => (
            <div key={f.label} style={{ background: '#18181b', borderRadius: 10, padding: '14px 18px', border: '1px solid #27272a' }}>
              <div style={{ fontSize: 11, color: '#52525b', textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</div>
              <div style={{ fontSize: 14, fontWeight: 500, color: f.color || '#fff' }}>{f.value}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'activité' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12 }}>
          {[
            { label: 'Total activations', value: s.billingCycleCount || 0, color: '#22c55e' },
            { label: 'Revenu généré', value: `${fmt((s.billingCycleCount || 0) * 3900)} XAF`, color: '#eab308' },
            { label: 'Filleuls parrainés', value: s.referredCount || 0, color: '#a855f7' },
            { label: 'Filleuls payants', value: s.paidReferrals || 0, color: '#3b82f6' },
          ].map(k => (
            <div key={k.label} style={{ background: '#18181b', borderRadius: 10, padding: 16, border: '1px solid #27272a' }}>
              <div style={{ fontSize: 11, color: '#52525b', marginBottom: 6 }}>{k.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'logs' && (
        <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid #27272a' }}>
              {['Date', 'Niveau', 'Message', 'Source'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {logs.filter(l => !l.path || l.path.includes('/store')).length === 0 ? (
                <tr><td colSpan={4} style={{ textAlign: 'center', padding: 40, color: '#71717a', fontSize: 13 }}>Aucun log trouvé</td></tr>
              ) : logs.filter(l => !l.path || l.path.includes('/store')).slice(0, 20).map((l, i) => (
                <tr key={l.id || i} style={{ borderBottom: '1px solid #27272a' }}>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>{new Date(l.date).toLocaleString('fr-FR')}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: l.type === 'error' ? '#ef444420' : l.type === 'security' ? '#dc262620' : '#3b82f620', color: l.type === 'error' ? '#ef4444' : l.type === 'security' ? '#dc2626' : '#3b82f6' }}>
                      {l.niveau}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa', maxWidth: 300 }}>{l.message}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>{l.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}