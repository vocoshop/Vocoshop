'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;
const agentName = (a: any) => a.name || [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Agent';

export default function AgentDetail() {
  const { id } = useParams();
  const router = useRouter();
  const [agent, setAgent] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' } | null>(null);
  const [showCommissionModal, setShowCommissionModal] = useState(false);
  const [newCommission, setNewCommission] = useState(800);

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
        const [ar, sr] = await Promise.all([
          fetch(`${API}/admin/agents?approved=true&limit=500`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/stores?limit=500`, { headers: h }).catch(() => null),
        ]);
        if (ar?.ok) {
          const d = await ar.json();
          const f = (d.agents || []).find((a: any) => (a.id || a._id) === id);
          if (f) setAgent(f);
        }
        if (sr?.ok) {
          const d = await sr.json();
          setStores(d.stores || []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [id]);

  const agentStores = agent ? stores.filter((s: any) => s.agentCode === agent.code) : [];
  const activeCount = agentStores.filter((s: any) => s.subscriptionStatus === 'active').length;
  const commission = activeCount * (agent?.commissionPerStore || 800);

  const handleSuspend = async () => {
    if (!confirm('Suspendre cet agent ?')) return;
    setActionLoading(true);
    const t = localStorage.getItem('adminToken');
    if (!t) { setActionLoading(false); return; }
    try {
      const r = await fetch(`${API}/admin/agents/${agent.code}/suspend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      }).catch(() => null);
      if (r?.ok) {
        setAgent({ ...agent, isActive: false });
        showToast('Agent suspendu', 'success');
      } else {
        showToast('Erreur lors de la suspension', 'error');
      }
    } catch { showToast('Erreur de connexion', 'error'); }
    setActionLoading(false);
  };

  const handleUpdateCommission = async () => {
    setActionLoading(true);
    const t = localStorage.getItem('adminToken');
    if (!t) { setActionLoading(false); return; }
    try {
      const r = await fetch(`${API}/admin/agents/${agent.code}/commission`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ commission: newCommission }),
      }).catch(() => null);
      if (r?.ok) {
        setAgent({ ...agent, commissionPerStore: newCommission });
        setShowCommissionModal(false);
        showToast('Commission mise à jour', 'success');
      } else {
        showToast('Erreur lors de la mise à jour', 'error');
      }
    } catch { showToast('Erreur de connexion', 'error'); }
    setActionLoading(false);
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh' }}><div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;
  if (!agent) return <div style={{ textAlign: 'center', padding: 60, color: '#71717a' }}>Agent non trouvé</div>;

  const a = agent;

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

      <button onClick={() => router.back()} style={{ background: 'transparent', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 13, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 6 }}>← Retour aux agents</button>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <div style={{ width: 60, height: 60, borderRadius: 16, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: '#fff' }}>{agentName(a)[0]}</div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>{agentName(a)}</h1>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <code style={{ background: '#27272a', padding: '2px 8px', borderRadius: 4, fontSize: 12, color: '#a855f7' }}>{a.code}</code>
            <span style={{ fontSize: 12, color: '#52525b' }}>· {a.phone}</span>
            {a.city && <span style={{ fontSize: 12, color: '#52525b' }}>· {a.city}</span>}
            <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: a.isActive ? '#22c55e20' : '#ef444420', color: a.isActive ? '#22c55e' : '#ef4444' }}>{a.isActive ? 'Actif' : 'Inactif'}</span>
            {a.isApproved !== undefined && (
              <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: a.isApproved ? '#22c55e20' : '#eab30820', color: a.isApproved ? '#22c55e' : '#eab308' }}>{a.isApproved ? 'Approuvé' : 'En attente'}</span>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Boutiques', value: agentStores.length, color: '#a855f7' },
          { label: 'Actives', value: activeCount, color: '#22c55e' },
          { label: 'Commission/boutique', value: `${(a.commissionPerStore || 800).toLocaleString()} XAF`, color: '#eab308' },
          { label: 'Total commissions', value: `${commission.toLocaleString()} XAF`, color: '#3b82f6' },
        ].map(s => (
          <div key={s.label} style={{ background: '#18181b', borderRadius: 10, padding: 16, border: '1px solid #27272a', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #27272a' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Informations</h3>
          {[
            { label: 'Nom', value: agentName(a) },
            { label: 'Code agent', value: a.code },
            { label: 'Téléphone', value: a.phone || '-' },
            { label: 'Ville', value: a.city || '-' },
            { label: 'Pays', value: a.country || '-' },
            { label: 'Genre', value: a.gender || '-' },
            { label: 'Dernière connexion', value: a.lastLoginAt ? new Date(a.lastLoginAt).toLocaleDateString('fr-FR') : 'Jamais' },
            { label: 'Inscription', value: a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '-' },
          ].map(f => (
            <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #27272a' }}>
              <span style={{ fontSize: 12, color: '#71717a' }}>{f.label}</span>
              <span style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{f.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #27272a' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Performance</h3>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#71717a' }}>Activation abonnement</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: agentStores.length > 0 && activeCount / agentStores.length > 0.5 ? '#22c55e' : '#eab308' }}>
                {agentStores.length > 0 ? `${Math.round((activeCount / agentStores.length) * 100)}%` : '0%'}
              </span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#27272a', overflow: 'hidden' }}>
              <div style={{ width: `${agentStores.length > 0 ? (activeCount / agentStores.length) * 100 : 0}%`, height: '100%', borderRadius: 3, background: '#a855f7', transition: 'width 0.5s' }} />
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: '#71717a' }}>Commissions / boutique</span>
              <span style={{ fontSize: 12, fontWeight: 600, color: '#22c55e' }}>{a.commissionPerStore || 800} XAF</span>
            </div>
            <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#27272a', overflow: 'hidden' }}>
              <div style={{ width: `${Math.min(((a.commissionPerStore || 800) / 1500) * 100, 100)}%`, height: '100%', borderRadius: 3, background: '#22c55e', transition: 'width 0.5s' }} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
            <button onClick={handleSuspend} disabled={actionLoading || !a.isActive} style={{
              padding: '8px 16px', background: '#eab30820', border: '1px solid #eab30830',
              borderRadius: 8, color: '#eab308', cursor: actionLoading || !a.isActive ? 'not-allowed' : 'pointer',
              fontSize: 12, opacity: actionLoading || !a.isActive ? 0.5 : 1,
            }}>Suspendre</button>
            <button onClick={() => { setNewCommission(a.commissionPerStore || 800); setShowCommissionModal(true); }} disabled={actionLoading} style={{
              padding: '8px 16px', background: '#a855f720', border: '1px solid #a855f730',
              borderRadius: 8, color: '#a855f7', cursor: actionLoading ? 'not-allowed' : 'pointer',
              fontSize: 12, opacity: actionLoading ? 0.5 : 1,
            }}>Modifier commission</button>
          </div>
        </div>
      </div>

      {showCommissionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowCommissionModal(false)}>
          <div style={{ background: '#18181b', borderRadius: 16, width: '100%', maxWidth: 340, padding: 24, border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Modifier commission</h3>
            <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
              {[500, 800, 1000, 1200].map(c => (
                <button key={c} onClick={() => setNewCommission(c)} style={{
                  flex: 1, padding: '10px', borderRadius: 8,
                  background: newCommission === c ? '#a855f7' : '#27272a',
                  border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600,
                }}>{c}</button>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowCommissionModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#27272a', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={handleUpdateCommission} disabled={actionLoading} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#a855f7', border: 'none', color: '#fff', cursor: actionLoading ? 'not-allowed' : 'pointer', opacity: actionLoading ? 0.6 : 1, fontSize: 13, fontWeight: 600 }}>
                {actionLoading ? '...' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>Boutiques ({agentStores.length})</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead><tr style={{ borderBottom: '1px solid #27272a' }}>
            {['Boutique', 'Téléphone', 'Ville', 'Statut', 'Dernière activité'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>)}
          </tr></thead>
          <tbody>
            {agentStores.length === 0 ? (
              <tr><td colSpan={5} style={{ textAlign: 'center', padding: 40, color: '#71717a', fontSize: 13 }}>Aucune boutique</td></tr>
            ) : agentStores.map((s: any) => (
              <tr key={s.storeId || s._id} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer' }} onClick={() => router.push(`/super-admin/boutiques/${s.storeId || s._id}`)}>
                <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#fff' }}>{s.storeName}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{s.phone || '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{s.city || '-'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{
                    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                    background: s.subscriptionStatus === 'active' ? '#22c55e20' : s.subscriptionStatus === 'trial' ? '#eab30820' : s.subscriptionStatus === 'grace' ? '#3b82f620' : '#ef444420',
                    color: s.subscriptionStatus === 'active' ? '#22c55e' : s.subscriptionStatus === 'trial' ? '#eab308' : s.subscriptionStatus === 'grace' ? '#3b82f6' : '#ef4444',
                  }}>
                    {s.subscriptionStatus === 'active' ? 'Actif' : s.subscriptionStatus === 'trial' ? 'Trial' : s.subscriptionStatus === 'grace' ? 'Grace' : 'Expiré'}
                  </span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>{s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString('fr-FR') : 'Jamais'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}