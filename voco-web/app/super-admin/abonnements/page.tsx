'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

const fmt = (n: number) => n.toLocaleString('fr-FR');
const sColor = (s?: string) => ({ active: '#22c55e', trial: '#eab308', grace: '#3b82f6', expired: '#ef4444', unused: '#71717a' })[s || ''] || '#71717a';
const sLabel = (s?: string) => ({ active: 'Actif', trial: 'Trial', grace: 'Grace', expired: 'Expiré', unused: 'Inactif' })[s || ''] || 'En attente';

function daysRemaining(dateStr?: string | null): number | null {
  if (!dateStr) return null;
  const d = new Date(dateStr).getTime();
  if (isNaN(d)) return null;
  return Math.ceil((d - Date.now()) / (1000 * 60 * 60 * 24));
}

export default function AbonnementsPage() {
  const router = useRouter();
  const [stores, setStores] = useState<any[]>([]);
  const [stats, setStats] = useState<any>({});
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) return router.push('/admin/login');
    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const [sr, str] = await Promise.all([
          fetch(`${API}/admin/stats`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/stores?limit=500`, { headers: h }).catch(() => null),
        ]);
        if (sr?.ok) setStats(await sr.json());
        if (str?.ok) setStores((await str.json()).stores || []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const filtered = filter === 'all' ? stores : stores.filter(s => {
    if (filter === 'active') return s.subscriptionStatus === 'active';
    if (filter === 'trial') return s.subscriptionStatus === 'trial';
    if (filter === 'grace') return s.subscriptionStatus === 'grace';
    if (filter === 'expired') return s.subscriptionStatus === 'expired';
    return !s.subscriptionStatus || s.subscriptionStatus === 'unused';
  });

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', height: '40vh', alignItems: 'center', color: '#71717a' }}><div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;

  const sub = stats.subscription || {};
  const monthlyRevenue = (sub.active || 0) * 3900;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>⭐ Abonnements</h2>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>
        {(sub.active || 0) + (sub.trial || 0) + (sub.grace || 0) + (sub.expired || 0) + (sub.unused || 0)} boutique(s) · {fmt(monthlyRevenue)} XAF/mois
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { key: 'all', label: 'Total', value: (sub.active||0)+(sub.trial||0)+(sub.grace||0)+(sub.expired||0)+(sub.unused||0), color: '#a855f7', bg: '#a855f715' },
          { key: 'active', label: 'Actifs', value: sub.active || 0, color: '#22c55e', bg: '#22c55e15' },
          { key: 'trial', label: 'Trial', value: sub.trial || 0, color: '#eab308', bg: '#eab30815' },
          { key: 'grace', label: 'Grace', value: sub.grace || 0, color: '#3b82f6', bg: '#3b82f615' },
          { key: 'expired', label: 'Expirés', value: sub.expired || 0, color: '#ef4444', bg: '#ef444415' },
          { key: 'unused', label: 'Inactifs', value: sub.unused || 0, color: '#71717a', bg: '#71717a15' },
        ].map(s => (
          <button key={s.key} onClick={() => setFilter(s.key)} style={{
            padding: 16, borderRadius: 10, background: filter === s.key ? s.bg : '#18181b',
            border: `1px solid ${filter === s.key ? s.color : '#27272a'}`, cursor: 'pointer', textAlign: 'center',
          }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{s.label}</div>
          </button>
        ))}
      </div>

      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
          <thead><tr style={{ borderBottom: '1px solid #27272a' }}>
            {['Boutique', 'Plan', 'Début', 'Expire le', 'Jours rest.', 'Statut', 'Agent'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 60, color: '#71717a', fontSize: 13 }}>Aucun abonnement</td></tr>
            ) : filtered.map(s => {
              const endDate = s.subscriptionStatus === 'active' ? s.paidUntil : s.subscriptionStatus === 'trial' ? s.trialEnd : s.subscriptionStatus === 'grace' ? s.graceUntil : null;
              const days = daysRemaining(endDate);
              const planLabel = s.plan || (s.subscriptionStatus === 'active' ? 'Mensuel 3 900 XAF' : s.subscriptionStatus === 'trial' ? 'Essai 7 jours' : s.subscriptionStatus === 'unused' ? '-' : s.plan || '-');

              return (
                <tr key={s.storeId || s.id} style={{ borderBottom: '1px solid #27272a' }}>
                  <td style={{ padding: '10px 14px', fontWeight: 500, color: '#fff', fontSize: 13, cursor: 'pointer' }} onClick={() => router.push(`/super-admin/boutiques/${s.storeId || s.id}`)}>
                    <div>{s.storeName}</div>
                    {s.autoRenew && <span style={{ fontSize: 10, color: '#22c55e', fontWeight: 500 }}>🔄 Renouvellement auto</span>}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{planLabel}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>{s.installedAt ? new Date(s.installedAt).toLocaleDateString('fr-FR') : '-'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>
                    {endDate ? new Date(endDate).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' }) : '-'}
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, fontWeight: 600 }}>
                    {days !== null ? (
                      <span style={{ color: days <= 0 ? '#ef4444' : days <= 3 ? '#eab308' : '#a1a1aa' }}>
                        {days <= 0 ? 'Expiré' : `${days} j`}
                      </span>
                    ) : (
                      <span style={{ color: '#52525b' }}>-</span>
                    )}
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, display: 'inline-block', width: 'fit-content', background: `${sColor(s.subscriptionStatus)}20`, color: sColor(s.subscriptionStatus) }}>
                        {sLabel(s.subscriptionStatus)}
                      </span>
                      {s.billingCycleCount > 0 && (
                        <span style={{ fontSize: 10, color: '#52525b' }}>{s.billingCycleCount} cycle(s)</span>
                      )}
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#a855f7' }}>{s.agentCode || '-'}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
