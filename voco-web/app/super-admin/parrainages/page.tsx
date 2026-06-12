'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const fmt = (n: number) => n.toLocaleString('fr-FR');

export default function ParrainagesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalFilleuls: 0, totalReferrals: 0, totalPaidReferrals: 0, totalBonusRewarded: 0 });
  const [topReferrers, setTopReferrers] = useState<any[]>([]);

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) { router.push('/admin/login'); return; }
    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const r = await fetch(`${API}/admin/parrainages`, { headers: h }).catch(() => null);
        if (r?.ok) {
          const d = await r.json();
          setStats(d.stats);
          setTopReferrers(d.topReferrers || []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const totalFreeMonths = topReferrers.reduce((s, r) => s + (r.freeMonths || 0), 0);
  const conversionRate = stats.totalReferrals > 0 ? Math.round((stats.totalPaidReferrals / stats.totalReferrals) * 100) : 0;

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', height: '40vh', alignItems: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>🔗 Parrainages</h2>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>
        {fmt(stats.totalFilleuls)} filleuls · {fmt(stats.totalReferrals)} parrainages · {fmt(totalFreeMonths)} mois gratuits offerts
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 20 }}>
        {[
          { label: 'Filleuls', value: fmt(stats.totalFilleuls), color: '#a855f7' },
          { label: 'Parrainages totaux', value: fmt(stats.totalReferrals), color: '#3b82f6' },
          { label: 'Filleuls payants', value: fmt(stats.totalPaidReferrals), color: '#22c55e' },
          { label: 'Taux conversion', value: `${conversionRate}%`, color: conversionRate > 50 ? '#22c55e' : '#eab308' },
          { label: 'Mois gratuits offerts', value: `${fmt(totalFreeMonths)} mois`, color: '#eab308' },
          { label: 'Payants en cours', value: `${fmt(stats.totalPaidReferrals % 3)}/3`, color: '#22c55e' },
        ].map(s => (
          <div key={s.label} style={{ background: '#18181b', borderRadius: 10, padding: 16, border: '1px solid #27272a', textAlign: 'center' }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>🏆 Top parrains</h3>
        </div>
        {topReferrers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#71717a', fontSize: 13 }}>Aucun parrainage pour le moment</div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead><tr style={{ borderBottom: '1px solid #27272a' }}>
              {['Boutique', 'Filleuls', 'Payants', 'Taux conv.', 'Mois gratuits', 'Progression'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {topReferrers.map((r, i) => (
                <tr key={r.storeId} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer' }} onClick={() => router.push(`/super-admin/boutiques/${r.storeId}`)}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 20, height: 20, borderRadius: 6, background: ['#a855f7','#7c3aed','#6d28d9'][i] || '#27272a', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color: '#fff' }}>{i + 1}</span>
                      <span style={{ fontWeight: 500, color: '#fff', fontSize: 13 }}>{r.storeName}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#a1a1aa' }}>{r.referredCount}</td>
                  <td style={{ padding: '10px 14px', fontSize: 13, color: '#22c55e' }}>{r.paidReferrals}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: r.referredCount > 0 && (r.paidReferrals / r.referredCount) > 0.6 ? '#22c55e' : '#eab308' }}>
                      {r.referredCount > 0 ? Math.round((r.paidReferrals / r.referredCount) * 100) : 0}%
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#22c55e' }}>{r.freeMonths} mois</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ flex: 1, maxWidth: 60, height: 6, background: '#27272a', borderRadius: 3, overflow: 'hidden' }}>
                        <div style={{ width: `${(r.nextFreeProgress / 3) * 100}%`, height: '100%', background: '#a855f7', borderRadius: 3, transition: 'width 0.3s' }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#71717a' }}>{r.nextFreeProgress}/3</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
