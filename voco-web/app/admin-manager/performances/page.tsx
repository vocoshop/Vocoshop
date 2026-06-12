'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function ManagerPerformances() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [activityDays, setActivityDays] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('managerToken');
    if (!token) { router.push('/manager-login'); return; }
    const h = { Authorization: `Bearer ${token}` };
    const j = async (r: any, fb: any) => { try { return await r.json(); } catch { return fb; } };
    (async () => {
      try {
        const [ar, act] = await Promise.all([
          fetch(`${API}/admin-manager/agents?limit=100`, { headers: h }),
          fetch(`${API}/admin-manager/activity-stats?days=30`, { headers: h }),
        ]);
        setAgents((await j(ar, { agents: [] })).agents || []);
        setActivityDays((await j(act, { days: [] })).days || []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ textAlign: 'center', padding: 60, color: '#71717a', fontSize: 13 }}>Chargement...</div>;

  const maxVal = Math.max(...activityDays.map((d: any) => d.activity + (d.stores || 0)), 1);
  const weeklyData = activityDays.slice(-14);

  return (
    <div>
      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 24 }}>Performances</h1>

      {/* Activity chart */}
      <div style={{ background: '#111113', borderRadius: 12, padding: 20, border: '1px solid #1a1a1e', marginBottom: 24 }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 16px' }}>Activité quotidienne (14 jours)</h3>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
          {weeklyData.map((d: any, i: number) => {
            const actH = (d.activity / maxVal) * 100;
            const stH = ((d.stores || 0) / maxVal) * 100;
            return (
              <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: 100 }}>
                  <div style={{ width: '60%', height: `${Math.max(actH, 2)}%`, background: 'linear-gradient(to top, #7c3aed, #a855f7)', borderRadius: '4px 4px 0 0', opacity: 0.8, minHeight: 4 }} />
                  <div style={{ width: '60%', height: `${Math.max(stH, 2)}%`, background: '#22c55e', borderRadius: '4px 4px 0 0', opacity: 0.5, minHeight: 4, marginTop: 1 }} />
                </div>
                <span style={{ fontSize: 8, color: '#52525b', whiteSpace: 'nowrap' }}>{d.label?.split(' ')[0]}</span>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 11, color: '#71717a' }}>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#a855f7', marginRight: 4 }} />Activité</span>
          <span><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: '#22c55e', marginRight: 4 }} />Boutiques créées</span>
        </div>
      </div>

      {/* Agent performance table */}
      <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', overflow: 'auto' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #1a1a1e' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Classement performance agents</h3>
        </div>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 600 }}>
          <thead><tr style={{ borderBottom: '1px solid #1a1a1e', background: '#0a0a0c' }}>
            {['#', 'Agent', 'Boutiques', 'Actives', 'Taux activ.', 'Score'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {[...agents].sort((a, b) => (b.score || 0) - (a.score || 0)).map((a: any, i: number) => {
              const rate = a.total > 0 ? Math.round((a.active / a.total) * 100) : 0;
              return (
                <tr key={a._id} style={{ borderBottom: '1px solid #1a1a1e', cursor: 'pointer' }} onClick={() => router.push(`/admin-manager/agents/${a._id}`)}>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#71717a', fontWeight: 600 }}>{i + 1}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 28, height: 28, borderRadius: 6, background: i < 3 ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : '#1a1a1e', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 600, color: '#fff' }}>{(a.name || a.firstName || 'A')[0]}</div>
                      <span style={{ fontSize: 13, color: '#fff' }}>{a.name || [a.firstName, a.lastName].filter(Boolean).join(' ')}</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#fff' }}>{a.total}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#22c55e', fontWeight: 600 }}>{a.active}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 60, height: 6, borderRadius: 3, background: '#1a1a1e', overflow: 'hidden' }}>
                        <div style={{ width: `${rate}%`, height: '100%', borderRadius: 3, background: rate >= 50 ? '#22c55e' : rate >= 30 ? '#eab308' : '#ef4444' }} />
                      </div>
                      <span style={{ fontSize: 11, color: '#71717a' }}>{rate}%</span>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: a.score >= 80 ? '#22c55e' : a.score >= 60 ? '#eab308' : a.score >= 40 ? '#f97316' : '#ef4444' }}>{a.score}%</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
