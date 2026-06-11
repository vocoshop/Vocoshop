'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = '/api';

const SCORE_COLORS: Record<string, string> = {
  Excellent: '#22c55e', Correct: '#eab308',
  'A surveiller': '#f97316', Problematique: '#ef4444',
};
const SEV_COLORS: Record<string, string> = {
  danger: '#ef4444', warning: '#eab308', info: '#3b82f6',
};

function formatTime(d: Date) {
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) +
    ' ' + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
}

export default function ManagerDashboard() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [error, setError] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date>(new Date());

  const fetchData = useCallback(() => {
    const t = localStorage.getItem('adminToken') || localStorage.getItem('managerToken') || '';
    const headers: any = t ? { Authorization: `Bearer ${t}` } : {};
    Promise.all([
      fetch(API + '/admin-manager/agents?limit=100', { headers }).then(r => r.ok ? r.json() : { agents: [] }).catch(() => ({ agents: [] })),
      fetch(API + '/admin-manager/stores?limit=500', { headers }).then(r => r.ok ? r.json() : { stores: [] }).catch(() => ({ stores: [] })),
      fetch(API + '/admin-manager/alerts', { headers }).then(r => r.ok ? r.json() : { alerts: [] }).catch(() => ({ alerts: [] })),
    ]).then(([ad, sd, ald]) => {
      if ([ad, sd, ald].some((r: any) => r?.status === 401)) {
        localStorage.removeItem('adminToken'); localStorage.removeItem('managerToken');
        localStorage.removeItem('adminInfo'); localStorage.removeItem('managerInfo');
        window.location.href = '/admin/login'; return;
      }
      setAgents(ad.agents || []);
      setStores(sd.stores || []);
      setAlerts(ald.alerts || []);
      setError('');
      setUpdatedAt(new Date());
    }).catch(e => {
      setError(e.message || 'Erreur inconnue');
    }).finally(() => setLoading(false));
  }, []);

  useEffect(() => { fetchData(); const iv = setInterval(fetchData, 60000); return () => clearInterval(iv); }, [fetchData]);

  // Derived stats
  const totalStores = stores.length;
  const activeStores = stores.filter((s: any) => s.status === 'active' || s.subscriptionStatus === 'active').length;
  const storeRate = totalStores > 0 ? Math.round((activeStores / totalStores) * 100) : 0;

  const now = Date.now();
  const DAY = 86400000;
  const storesToday = stores.filter((s: any) => now - new Date(s.createdAt).getTime() < DAY).length;
  const storesYesterday = stores.filter((s: any) => {
    const diff = now - new Date(s.createdAt).getTime();
    return diff >= DAY && diff < 2 * DAY;
  }).length;

  const agentMap: Record<string, any> = {};
  agents.forEach((a) => { agentMap[(a.code || '').toLowerCase()] = a; });

  // Daily chart (last 14 days)
  const chartDays = 14;
  const chartData: { label: string; count: number; day: string }[] = [];
  for (let i = chartDays - 1; i >= 0; i--) {
    const d = new Date(now - i * DAY);
    const dayStr = d.toISOString().slice(0, 10);
    const label = d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
    const count = stores.filter((s: any) => new Date(s.createdAt).toISOString().slice(0, 10) === dayStr).length;
    chartData.push({ label, count, day: dayStr });
  }
  const maxCount = Math.max(...chartData.map(d => d.count), 3);

  const recentStores = [...stores].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).slice(0, 5);
  const rankedAgents = [...agents].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
  const topAlerts = alerts.slice(0, 4);
  const activeToday = agents.filter((a: any) => a.lastLoginAt && (now - new Date(a.lastLoginAt).getTime()) < DAY).length;

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
      <div style={{ width: 32, height: 32, border: '2px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (error) return <div style={{ color: '#ef4444', padding: 24 }}>Erreur : {error}</div>;

  const Trend = ({ val }: { val: number }) => {
    if (val === 0) return <span style={{ fontSize: 10, color: '#52525b' }}>--</span>;
    const up = val > 0;
    return <span style={{ fontSize: 10, color: up ? '#22c55e' : '#ef4444' }}>{up ? '+' : ''}{val}</span>;
  };

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>Tableau de bord</h1>
          <p style={{ fontSize: 11, color: '#52525b', margin: '2px 0 0 0' }}>Mis a jour {formatTime(updatedAt)}</p>
        </div>
        <button onClick={() => { setLoading(true); fetchData(); }}
          style={{ background: '#1a1a1e', border: '1px solid #27272a', borderRadius: 8, padding: '6px 14px', color: '#a1a1aa', fontSize: 11, cursor: 'pointer' }}>
          Actualiser
        </button>
      </div>

      {/* KPI */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
        {[
          { label: 'Boutiques', value: totalStores, color: '#fff' },
          { label: 'Actives', value: activeStores, color: '#22c55e', sub: `${storeRate}%` },
          { label: 'Agents', value: agents.length, color: '#fff', sub: `${activeToday} en ligne` },
          { label: 'Alertes', value: alerts.length, color: alerts.length > 0 ? '#ef4444' : '#fff' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#111113', borderRadius: 10, border: '1px solid #1a1a1e', padding: '14px 16px' }}>
            <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>{k.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: k.color }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>{k.sub}</div>}
          </div>
        ))}
      </div>

      {/* Activity chart + Alerts */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 12, marginBottom: 20 }}>

        {/* Chart */}
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: '12px 14px' }}>
          <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 10 }}>Boutiques crées (14 jours)</div>
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 72 }}>
            {chartData.map((d, i) => {
              const h = Math.max(Math.round((d.count / maxCount) * 60), d.count > 0 ? 4 : 0);
              const isToday = i === chartData.length - 1;
              return (
                <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', height: h, borderRadius: '3px 3px 0 0', background: isToday ? 'linear-gradient(180deg, #a855f7, #7c3aed)' : '#27272a', minHeight: d.count > 0 ? 4 : 0, transition: 'height 0.3s' }} />
                  <span style={{ fontSize: 7, color: isToday ? '#a855f7' : '#52525b', writingMode: 'vertical-lr', textOrientation: 'mixed', transform: 'rotate(180deg)', height: 12, lineHeight: '12px' }}>{d.label}</span>
                </div>
              );
            })}
          </div>
          {storesToday > 0 && <div style={{ fontSize: 10, color: '#52525b', marginTop: 6 }}>
            <Trend val={storesToday - storesYesterday} /> aujourd'hui vs hier
          </div>}
        </div>

        {/* Alerts */}
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1e', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>Alertes</span>
            {alerts.length > 4 && (
              <span style={{ fontSize: 10, color: '#a855f7', cursor: 'pointer' }} onClick={() => router.push('/admin-manager/alertes')}>
                Voir tout ({alerts.length})
              </span>
            )}
          </div>
          {topAlerts.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#52525b', fontSize: 12 }}>Aucune alerte</div>
          ) : topAlerts.map((a: any, i: number) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid #0a0a0c' }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: SEV_COLORS[a.type] || '#71717a', flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 12, fontWeight: 500, color: '#fff' }}>{a.label}</div>
                <div style={{ fontSize: 10, color: '#71717a' }}>
                  {a.store && <span style={{ cursor: 'pointer', color: '#a855f7' }} onClick={() => router.push('/admin-manager/boutiques/' + a.storeId)}>{a.store}</span>}
                  {a.store && a.agent && <span> </span>}
                  {a.agent && <span style={{ cursor: 'pointer', color: '#a855f7' }} onClick={() => router.push('/admin-manager/agents/' + a.agentId)}>{a.agent}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent stores + Agent ranking */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: 12, marginBottom: 20 }}>
        {/* Recent stores */}
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1e', fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>Dernieres boutiques</div>
          {recentStores.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#52525b', fontSize: 12 }}>Aucune boutique</div>
          ) : recentStores.map((s: any) => {
            const agent = agentMap[(s.agentCode || '').toLowerCase()];
            const days = Math.round((now - new Date(s.createdAt).getTime()) / DAY);
            return (
              <div key={s._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid #0a0a0c', cursor: 'pointer' }}
                onClick={() => router.push('/admin-manager/boutiques/' + s._id)}>
                <div style={{ width: 24, height: 24, borderRadius: 6, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                  {(s.storeName || s.name || 'B')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{s.storeName || s.name || 'Sans nom'}</div>
                  <div style={{ fontSize: 10, color: '#71717a' }}>{agent?.name || s.agentCode || '?'} · {days === 0 ? "Aujourd'hui" : `Il y a ${days}j`}</div>
                </div>
                <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: s.subscriptionStatus === 'active' ? '#052e16' : '#1a1a1e', color: s.subscriptionStatus === 'active' ? '#22c55e' : '#71717a', whiteSpace: 'nowrap' }}>
                  {s.subscriptionStatus === 'active' ? 'Active' : s.subscriptionStatus === 'trial' ? 'Essai' : s.subscriptionStatus || 'Inactive'}
                </span>
              </div>
            );
          })}
        </div>

        {/* Agent ranking */}
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', overflow: 'hidden' }}>
          <div style={{ padding: '10px 14px', borderBottom: '1px solid #1a1a1e', fontSize: 12, fontWeight: 600, color: '#a1a1aa' }}>Classement agents</div>
          {rankedAgents.length === 0 ? (
            <div style={{ padding: 20, textAlign: 'center', color: '#52525b', fontSize: 12 }}>Aucun agent</div>
          ) : rankedAgents.slice(0, 5).map((a: any, i: number) => {
            const maxStores = Math.max(...rankedAgents.map((x: any) => x.total || 0), 1);
            const barPct = Math.round(((a.total || 0) / maxStores) * 100);
            return (
              <div key={a._id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px', borderBottom: '1px solid #0a0a0c', cursor: 'pointer' }}
                onClick={() => router.push('/admin-manager/agents/' + a._id)}>
                <span style={{ fontSize: 10, fontWeight: 700, color: '#52525b', width: 16, textAlign: 'right' }}>{i + 1}</span>
                <div style={{ width: 22, height: 22, borderRadius: 6, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 600, color: '#fff', flexShrink: 0 }}>
                  {(a.name || a.code || '?')[0]}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 500, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name || a.code}</div>
                  <div style={{ width: '100%', height: 4, background: '#1a1a1e', borderRadius: 2, marginTop: 3 }}>
                    <div style={{ width: `${barPct}%`, height: 4, borderRadius: 2, background: 'linear-gradient(90deg, #7c3aed, #a855f7)' }} />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: SCORE_COLORS[a.label] || '#fff' }}>{a.score || 0}</div>
                  <div style={{ fontSize: 9, color: '#71717a' }}>{a.active || 0}/{a.total || 0}</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
