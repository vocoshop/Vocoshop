'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

function useWindowSize() {
  const [s, ss] = useState({ w: 0, h: 0 });
  useEffect(() => { const h = () => ss({ w: window.innerWidth, h: window.innerHeight }); h(); window.addEventListener('resize', h); return () => window.removeEventListener('resize', h); }, []);
  return s;
}

const fmt = (n: number) => n.toLocaleString('fr-FR');
const sColor = (s?: string) => ({ active: '#22c55e', trial: '#eab308', grace: '#3b82f6', expired: '#ef4444', unused: '#71717a' })[s || ''] || '#71717a';
const sLabel = (s?: string) => ({ active: 'Actif', trial: 'Trial', grace: 'Grace', expired: 'Expiré', unused: 'Inactif' })[s || ''] || 'En attente';
const agentName = (a: any) => a.name || [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Agent';

export default function SuperAdminDashboard() {
  const { w } = useWindowSize();
  const isMobile = w < 768;
  const isTablet = w >= 768 && w < 1024;
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<any>({ stores: { total: 0 }, agents: { total: 0, active: 0 }, subscription: {} });
  const [stores, setStores] = useState<any[]>([]);
  const [agents, setAgents] = useState<any[]>([]);
  const [candidates, setCandidates] = useState<any[]>([]);
  const [activityDays, setActivityDays] = useState<any[]>([]);
  const [showActivity, setShowActivity] = useState(false);
  const [timeFilter, setTimeFilter] = useState('30d');
  const [todayStats, setTodayStats] = useState<any>({ newStores: 0, newAgents: 0, renewals: 0, revenue: 0, activeToday: 0 });
  const [tooltip, setTooltip] = useState<{ x: number; y: number; activity: number; stores: number; label: string } | null>(null);
  const [rankingMode, setRankingMode] = useState<'national' | 'city'>('national');
  const [selectedCity, setSelectedCity] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) { router.push('/admin/login'); return; }
    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const j = async (r: any, fb: any) => { try { return await r.json(); } catch { return fb; } };
        const [sr, ar, str, pr, act] = await Promise.all([
          fetch(`${API}/admin/stats`, { headers: h }).catch(() => ({ ok: false, json: () => ({}) })),
          fetch(`${API}/admin/agents?approved=true&limit=100`, { headers: h }).catch(() => ({ ok: false, json: () => ({}) })),
          fetch(`${API}/admin/stores?limit=500`, { headers: h }).catch(() => ({ ok: false, json: () => ({}) })),
          fetch(`${API}/admin/agents?approved=pending&limit=50`, { headers: h }).catch(() => ({ ok: false, json: () => ({}) })),
          fetch(`${API}/admin/activity-stats?days=90`, { headers: h }).catch(() => ({ ok: false, json: () => ({}) })),
        ]);
        const sd = await j(sr, {}); const ad = await j(ar, { agents: [] }); const std = await j(str, { stores: [] });
        const pd = await j(pr, { agents: [] }); const actd = await j(act, { days: [] });
        if ([sr, ar, str, pr, act].some((r: any) => r?.status === 401)) {
          localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo');
          router.push('/admin/login'); return;
        }
        if (sr.ok) {
          setStats(sd);
          const today = new Date().toDateString();
          const newStoresToday = (std.stores || []).filter((s: any) => s.installedAt && new Date(s.installedAt).toDateString() === today).length;
          const activeToday = (std.stores || []).filter((s: any) => {
            if (!s.lastActiveAt) return false;
            const lastActive = new Date(s.lastActiveAt).toDateString();
            return lastActive === today || (Date.now() - new Date(s.lastActiveAt).getTime()) < 86400000;
          }).length;
          const renewalsToday = (std.stores || []).filter((s: any) => {
            if (!s.paidUntil) return false;
            const next = new Date(s.paidUntil);
            next.setDate(next.getDate() - 30);
            return next.toDateString() === today;
          }).length;
          const newAgentsToday = (ad.agents || []).filter((a: any) => a.createdAt && new Date(a.createdAt).toDateString() === today).length;
          setTodayStats({
            newStores: newStoresToday,
            newAgents: newAgentsToday,
            renewals: renewalsToday,
            revenue: (sd.subscription?.active || 0) * 3900,
            activeToday,
          });
        }
        if (ar.ok) setAgents(ad.agents || []); if (str.ok) setStores(std.stores || []);
        if (pr.ok) setCandidates(pd.agents || []); if (act.ok) setActivityDays(actd.days || []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const activeSubs = stats.subscription?.active ?? 0;
  const trialSubs = stats.subscription?.trial ?? 0;
  const expiredSubs = stats.subscription?.expired ?? 0;
  const graceSubs = stats.subscription?.grace ?? 0;
  const totalStores = stats.stores?.total ?? stores.length;
  const monthlyRevenue = activeSubs * 3900;

  const filteredDays = timeFilter === 'all' ? activityDays : timeFilter === '7d' ? activityDays.slice(-7) : activityDays.slice(-30);
  const maxActivity = Math.max(...filteredDays.map((d: any) => d.activity), 1);
  const maxStores = Math.max(...filteredDays.map((d: any) => d.stores || 0), 1);

  const agentStoreCount: Record<string, number> = {};
  stores.forEach((s: any) => {
    const code = (s.agentCode || '').toLowerCase();
    if (code) agentStoreCount[code] = (agentStoreCount[code] || 0) + 1;
  });

  const allActivities = [
    ...stores.slice(0, 3).map((s: any) => ({ icon: '🏪', title: s.storeName, desc: `${s.city || '-'} · ${sLabel(s.subscriptionStatus)}`, time: s.lastActiveAt ? new Date(s.lastActiveAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '-' })),
    ...agents.slice(0, 2).map((a: any) => ({ icon: '👤', title: agentName(a), desc: a.city || '-', time: a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '-' })),
    ...candidates.slice(0, 2).map((c: any) => ({ icon: '📝', title: agentName(c), desc: 'Candidature en attente', time: c.createdAt ? new Date(c.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' }) : '-' })),
  ].slice(0, 5);

  const kpis = [
    { label: 'Boutiques totales', value: totalStores, sub: `${activeSubs} actives · ${trialSubs} trial · ${graceSubs} grace`, icon: '🏪', color: '#a855f7' },
    { label: 'Abonnements actifs', value: activeSubs, sub: `${fmt(monthlyRevenue)} XAF/mois`, icon: '⭐', color: '#22c55e' },
    { label: 'Revenus plateforme', value: monthlyRevenue, sub: `${fmt(monthlyRevenue)} XAF/mois · ${fmt(monthlyRevenue * 12)} XAF/an`, icon: '💰', color: '#eab308' },
    { label: 'Agents actifs', value: stats.agents?.active || 0, sub: `${stats.agents?.total || 0} total · ${candidates.length} en attente`, icon: '👥', color: '#3b82f6' },
  ];

  // Smooth bezier curve generator
  function bezierPath(points: { x: number; y: number }[]): string {
    if (points.length === 0) return '';
    if (points.length === 1) return `M${points[0].x},${points[0].y}`;
    let d = `M${points[0].x},${points[0].y}`;
    for (let i = 0; i < points.length - 1; i++) {
      const p0 = points[i];
      const p1 = points[i + 1];
      const cp1x = p0.x + (p1.x - p0.x) / 2;
      const cp1y = p0.y;
      const cp2x = p0.x + (p1.x - p0.x) / 2;
      const cp2y = p1.y;
      d += ` C${cp1x},${cp1y} ${cp2x},${cp2y} ${p1.x},${p1.y}`;
    }
    return d;
  }

  // Y-axis labels
  const yLabels = [0, 25, 50, 75, 100];
  const yMax = Math.max(maxActivity, maxStores);
  const ySteps = [0, Math.round(yMax * 0.25), Math.round(yMax * 0.5), Math.round(yMax * 0.75), yMax];

  const chartH = 200;
  const chartW = 600;
  const padLeft = 40;
  const padRight = 10;

  const cx = (i: number) => padLeft + (i / Math.max(filteredDays.length - 1, 1)) * (chartW - padLeft - padRight);
  const cy = (v: number) => chartH - 20 - ((v / yMax) * (chartH - 40));

  const actPoints = filteredDays.map((d: any, i: number) => ({ x: cx(i), y: cy(d.activity) }));
  const storePoints = filteredDays.map((d: any, i: number) => ({ x: cx(i), y: cy(d.stores || 0) }));

  const actPath = bezierPath(actPoints);
  const storePath = bezierPath(storePoints);
  const areaPath = actPoints.length > 0
    ? `${actPath} L${actPoints[actPoints.length - 1].x},${chartH - 20} L${actPoints[0].x},${chartH - 20} Z`
    : '';

  const lastAct = filteredDays[filteredDays.length - 1];
  const prevAct = filteredDays[filteredDays.length - 2];
  const actTrend = lastAct && prevAct ? lastAct.activity - prevAct.activity : 0;

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ marginTop: 16, fontSize: 14 }}>Chargement du dashboard...</p>
    </div>
  );

  const enrichedAgents = agents;

  const uniqueCities: string[] = [...new Set([...stores.map((s: any) => s.city), ...agents.map((a: any) => a.city)].filter(Boolean))].sort();

  const storesByCity = (city: string) => stores.filter((s: any) => (s.city || '').toLowerCase() === city.toLowerCase());

  const buildRanking = (storePool: any[]) => [...enrichedAgents]
    .map(a => {
      const lc = (a.code || '').toLowerCase();
      const agentStores = storePool.filter(s => (s.agentCode || '').toLowerCase() === lc);
      return { ...a, _active: agentStores.filter(s => s.subscriptionStatus === 'active').length, _total: agentStores.length };
    })
    .sort((a, b) => {
      if (b._active !== a._active) return b._active - a._active;
      return b._total - a._total;
    })
    .slice(0, 5)
    .filter(a => a._total > 0);

  const topAgents = rankingMode === 'national' ? buildRanking(stores)
    : selectedCity ? buildRanking(storesByCity(selectedCity))
    : [];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 16 }}>
        {[
          { label: 'Boutiques aujourd\'hui', value: todayStats.newStores, icon: '🏪', color: '#a855f7' },
          { label: 'Agents aujourd\'hui', value: todayStats.newAgents, icon: '👤', color: '#3b82f6' },
          { label: 'Renouvellements', value: todayStats.renewals, icon: '🔄', color: '#22c55e' },
          { label: 'Actifs ce jour', value: todayStats.activeToday, icon: '🟢', color: '#eab308' },
        ].map((k, i) => (
          <div key={i} style={{ background: '#18181b', borderRadius: 10, padding: '14px 16px', border: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 20 }}>{k.icon}</span>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: k.color }}>{k.value}</div>
              <div style={{ fontSize: 10, color: '#71717a' }}>{k.label}</div>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 16, marginBottom: 24 }}>
        {kpis.map((k, i) => (
          <div key={i} style={{ background: '#18181b', borderRadius: 12, padding: '20px', border: '1px solid #27272a', transition: 'all 0.2s', cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 10, background: `${k.color}15`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{k.icon}</div>
            </div>
            <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 700, color: '#fff', marginBottom: 4 }}>{typeof k.value === 'number' && k.value >= 1000 ? (k.value / 1000).toFixed(1) + 'K' : fmt(k.value)}</div>
            <div style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 6 }}>{k.label}</div>
            <div style={{ fontSize: 11, color: '#52525b' }}>{k.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
        <div style={{ display: 'flex', background: '#18181b', borderRadius: 8, padding: 3 }}>
          {[{k:'all',l:'Global'},{k:'7d',l:'7j'},{k:'30d',l:'30j'}].map(t => (
            <button key={t.k} onClick={() => setTimeFilter(t.k)} style={{
              padding: '6px 14px', borderRadius: 6, background: timeFilter === t.k ? '#27272a' : 'transparent',
              border: 'none', color: timeFilter === t.k ? '#fff' : '#71717a', cursor: 'pointer', fontSize: 12, fontWeight: 500,
            }}>{t.l}</button>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '2fr 1fr', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #27272a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>Activité de la plateforme</h3>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 8 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4 }}>
                  <span style={{ fontSize: 24, fontWeight: 700, color: '#fff' }}>{filteredDays.reduce((s: number, d: any) => s + (d.activity || 0), 0)}</span>
                  <span style={{ fontSize: 11, color: '#71717a' }}>actions</span>
                  {actTrend !== 0 && (
                    <span style={{ fontSize: 11, fontWeight: 600, color: actTrend > 0 ? '#22c55e' : '#ef4444', marginLeft: 4 }}>
                      {actTrend > 0 ? '↑' : '↓'} {Math.abs(actTrend)}
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 11, color: '#71717a' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: '50%', background: 'linear-gradient(135deg, #a78bfa, #7c3aed)', boxShadow: '0 0 6px rgba(168,85,247,0.4)' }} />
                Activités
                <span style={{ color: '#a1a1aa', fontWeight: 600 }}>{filteredDays.length > 0 ? filteredDays[filteredDays.length - 1]?.activity || 0 : 0}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 10, height: 10, borderRadius: 2, background: '#22c55e' }} />
                Boutiques
                <span style={{ color: '#a1a1aa', fontWeight: 600 }}>{filteredDays.length > 0 ? filteredDays[filteredDays.length - 1]?.stores || 0 : 0}</span>
              </div>
            </div>
          </div>

          {/* Chart */}
          <div style={{ position: 'relative' }}>
            <svg viewBox={`0 0 ${chartW} ${chartH}`} style={{ width: '100%', height: chartH, overflow: 'visible' }}
              onMouseMove={(e) => {
                const rect = e.currentTarget.getBoundingClientRect();
                const svgX = (e.clientX - rect.left) / rect.width * chartW;
                const svgY = (e.clientY - rect.top) / rect.height * chartH;
                let closest: any = null;
                let minDist = Infinity;
                filteredDays.forEach((d: any, i: number) => {
                  const dx = svgX - cx(i);
                  const dy = svgY - cy(d.activity || 0);
                  const dist = Math.sqrt(dx*dx + dy*dy);
                  if (dist < minDist) { minDist = dist; closest = { d, i }; }
                });
                const relX = e.clientX - rect.left;
                const relY = e.clientY - rect.top;
                if (closest && minDist < 60) {
                  const d = closest.d;
                  setTooltip({ x: relX, y: relY, activity: d.activity || 0, stores: d.stores || 0, label: d.label || '' });
                } else {
                  setTooltip(null);
                }
              }}
              onMouseLeave={() => setTooltip(null)}>
              <defs>
                <linearGradient id="actGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a78bfa" stopOpacity="0.35" />
                  <stop offset="100%" stopColor="#a78bfa" stopOpacity="0.02" />
                </linearGradient>
                <linearGradient id="actLineGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="#7c3aed" />
                  <stop offset="100%" stopColor="#a78bfa" />
                </linearGradient>
                <filter id="glow">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>

              {/* Y-axis grid lines + labels */}
              {ySteps.map((v, i) => (
                <g key={i}>
                  <line x1={padLeft} y1={cy(v)} x2={chartW - padRight} y2={cy(v)} stroke="#27272a" strokeWidth={1} strokeDasharray={i === 0 ? '0' : '3 3'} />
                  <text x={padLeft - 8} y={cy(v) + 3} textAnchor="end" fill="#52525b" fontSize={10} fontFamily="system-ui">{v}</text>
                </g>
              ))}

              {/* Area fill */}
              {actPoints.length > 0 && (
                <path d={areaPath} fill="url(#actGrad)" />
              )}

              {/* Store line (dashed) */}
              {storePoints.length > 1 && (
                <path d={storePath} fill="none" stroke="#22c55e" strokeWidth={1.5} strokeDasharray="5 3" opacity={0.6} />
              )}

              {/* Store dots */}
              {storePoints.map((p, i) => (
                <circle key={`sd${i}`} cx={p.x} cy={p.y} r={2.5} fill="#22c55e" opacity={0.5} />
              ))}

              {/* Activity line */}
              {actPoints.length > 1 && (
                <path d={actPath} fill="none" stroke="url(#actLineGrad)" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
              )}

              {/* Activity dots */}
              {actPoints.map((p, i) => (
                <g key={`ad${i}`}>
                  <circle cx={p.x} cy={p.y} r={i === actPoints.length - 1 ? 6 : 3} fill={i === actPoints.length - 1 ? '#a78bfa' : '#a78bfa'} stroke="#18181b" strokeWidth={2} style={i === actPoints.length - 1 ? { filter: 'url(#glow)' } : {}} />
                </g>
              ))}

              {/* X-axis labels (show first, middle, last) */}
              {filteredDays.length > 0 && (
                <>
                  <text x={cx(0)} y={chartH - 2} textAnchor="start" fill="#52525b" fontSize={9} fontFamily="system-ui">{filteredDays[0].label?.split(' ').slice(0, 2).join(' ') || ''}</text>
                  {filteredDays.length > 2 && (
                    <text x={cx(Math.floor(filteredDays.length / 2))} y={chartH - 2} textAnchor="middle" fill="#52525b" fontSize={9} fontFamily="system-ui">
                      {filteredDays[Math.floor(filteredDays.length / 2)].label?.split(' ').slice(0, 2).join(' ') || ''}
                    </text>
                  )}
                  <text x={cx(filteredDays.length - 1)} y={chartH - 2} textAnchor="end" fill="#52525b" fontSize={9} fontFamily="system-ui">{filteredDays[filteredDays.length - 1].label?.split(' ').slice(0, 2).join(' ') || ''}</text>
                </>
              )}
            </svg>

            {/* Tooltip */}
            {tooltip && (
              <div style={{
                position: 'absolute',
                left: tooltip.x,
                top: tooltip.y - 50,
                transform: 'translateX(-50%)',
                background: '#27272a',
                border: '1px solid #3f3f46',
                borderRadius: 8,
                padding: '8px 12px',
                pointerEvents: 'none',
                zIndex: 10,
                boxShadow: '0 10px 30px rgba(0,0,0,0.4)',
              }}>
                <div style={{ fontSize: 10, color: '#71717a', marginBottom: 4 }}>{tooltip.label}</div>
                <div style={{ display: 'flex', gap: 12, fontSize: 11 }}>
                  <span style={{ color: '#a78bfa' }}>● {tooltip.activity} activités</span>
                  <span style={{ color: '#22c55e' }}>■ {tooltip.stores} boutiques</span>
                </div>
              </div>
            )}
          </div>

          {/* Bottom legend with trend */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 12, borderTop: '1px solid #27272a', paddingTop: 12 }}>
            <div style={{ display: 'flex', gap: 20, fontSize: 11 }}>
              <div style={{ color: '#71717a' }}>
                Total activités <span style={{ color: '#a1a1aa', fontWeight: 600 }}>{filteredDays.reduce((s: number, d: any) => s + (d.activity || 0), 0)}</span>
              </div>
              <div style={{ color: '#71717a' }}>
                Total boutiques <span style={{ color: '#a1a1aa', fontWeight: 600 }}>{filteredDays.reduce((s: number, d: any) => s + (d.stores || 0), 0)}</span>
              </div>
            </div>
            <div style={{ fontSize: 10, color: '#52525b' }}>
              {timeFilter === '7d' ? '7 derniers jours' : timeFilter === '30d' ? '30 derniers jours' : 'Tout l\'historique'}
            </div>
          </div>
        </div>

        <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #27272a' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>Activité récente</h3>
            <button onClick={() => setShowActivity(true)} style={{ background: 'transparent', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Voir tout →</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {allActivities.map((a, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px', background: '#27272a', borderRadius: 8 }}>
                <span style={{ fontSize: 18 }}>{a.icon}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: '#71717a' }}>{a.desc}</div>
                </div>
                <span style={{ fontSize: 10, color: '#52525b' }}>{a.time}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {(expiredSubs > 0 || candidates.length > 0) && (
        <div style={{ marginBottom: 24 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: 0 }}>Alertes importantes</h3>
            {expiredSubs > 0 && <span style={{ background: '#ef4444', color: '#fff', padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 600 }}>{expiredSubs}</span>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(3,1fr)', gap: 12 }}>
            {expiredSubs > 0 && (
              <div style={{ background: '#18181b', borderRadius: 8, padding: 16, borderLeft: '3px solid #ef4444' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{expiredSubs} boutique(s) expirée(s)</div>
                <div style={{ fontSize: 12, color: '#a1a1aa' }}>Abonnements nécessitent renouvellement</div>
              </div>
            )}
            {candidates.length > 0 && (
              <div style={{ background: '#18181b', borderRadius: 8, padding: 16, borderLeft: '3px solid #3b82f6' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{candidates.length} candidat(s) en attente</div>
                <div style={{ fontSize: 12, color: '#a1a1aa' }}>Nouvelles candidatures à valider</div>
              </div>
            )}
            {trialSubs > 0 && (
              <div style={{ background: '#18181b', borderRadius: 8, padding: 16, borderLeft: '3px solid #eab308' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{trialSubs} essai(s) gratuit</div>
                <div style={{ fontSize: 12, color: '#a1a1aa' }}>Essais gratuits en cours</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 16 }}>
        <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Top Agents</h3>
              <div style={{ display: 'flex', background: '#09090b', borderRadius: 6, padding: 2 }}>
                <button onClick={() => { setRankingMode('national'); setSelectedCity(''); }} style={{
                  padding: '4px 10px', borderRadius: 4, background: rankingMode === 'national' ? '#27272a' : 'transparent',
                  border: 'none', color: rankingMode === 'national' ? '#fff' : '#71717a', cursor: 'pointer', fontSize: 10, fontWeight: 500,
                }}>National</button>
                <button onClick={() => setRankingMode('city')} style={{
                  padding: '4px 10px', borderRadius: 4, background: rankingMode === 'city' ? '#27272a' : 'transparent',
                  border: 'none', color: rankingMode === 'city' ? '#fff' : '#71717a', cursor: 'pointer', fontSize: 10, fontWeight: 500,
                }}>Par ville</button>
              </div>
              {rankingMode === 'city' && (
                <select value={selectedCity} onChange={e => setSelectedCity(e.target.value)} style={{
                  background: '#09090b', border: '1px solid #27272a', borderRadius: 6, padding: '4px 8px',
                  color: '#fff', fontSize: 11, cursor: 'pointer',
                }}>
                  <option value="">Choisir une ville</option>
                  {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
            </div>
            <button onClick={() => router.push('/super-admin/agents')} style={{ background: 'transparent', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: 12 }}>Voir tout →</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid #27272a' }}>
                {['Agent','Code','Ville','Actives','Total','Statut'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {topAgents.map((a, i) => (
                  <tr key={a.id} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer' }} onClick={() => router.push(`/super-admin/agents/${a.id}`)}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff' }}>{agentName(a)[0]}</div>
                        <div><div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{agentName(a)}</div><div style={{ fontSize: 11, color: '#52525b' }}>{a.phone}</div></div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#a855f7' }}>{a.code}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{a.city || '-'}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#22c55e', fontWeight: 600 }}>{a._active}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{a._total}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: a.isActive ? '#22c55e20' : '#ef444420', color: a.isActive ? '#22c55e' : '#ef4444' }}>{a.isActive ? 'Actif' : 'Inactif'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Dernières boutiques</h3>
            <button onClick={() => router.push('/super-admin/boutiques')} style={{ background: 'transparent', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: 12 }}>Voir tout →</button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr style={{ borderBottom: '1px solid #27272a' }}>
                {['Boutique','Téléphone','Statut','Agent'].map(h => <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>)}
              </tr></thead>
              <tbody>
                {stores.slice(0, 5).map(s => (
                  <tr key={s.storeId || s.id} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer' }} onClick={() => router.push(`/super-admin/boutiques/${s.storeId || s.id}`)}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 500, color: '#fff' }}>{s.storeName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{s.phone}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${sColor(s.subscriptionStatus)}20`, color: sColor(s.subscriptionStatus) }}>{sLabel(s.subscriptionStatus)}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11, color: '#a855f7' }}>{s.agentCode || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showActivity && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowActivity(false)}>
          <div style={{ background: '#18181b', borderRadius: 20, width: '90%', maxWidth: 600, maxHeight: '80vh', overflow: 'hidden', border: '1px solid #27272a', animation: 'scaleIn 0.2s ease-out' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid #27272a' }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>Activité récente</h2>
              <button onClick={() => setShowActivity(false)} style={{ background: '#27272a', border: 'none', color: '#fff', width: 32, height: 32, borderRadius: 8, cursor: 'pointer', fontSize: 16 }}>✕</button>
            </div>
            <div style={{ padding: 24, maxHeight: 'calc(80vh - 80px)', overflow: 'auto' }}>
              <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
                {[
                  { icon: '🏪', value: stores.length, label: 'Boutiques' },
                  { icon: '👤', value: agents.length, label: 'Agents' },
                  { icon: '📝', value: candidates.length, label: 'Candidats' },
                ].map((s, i) => (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 16, background: '#27272a', borderRadius: 12 }}>
                    <span style={{ fontSize: 22, marginBottom: 6 }}>{s.icon}</span>
                    <span style={{ fontSize: 22, fontWeight: 700, color: '#fff' }}>{s.value}</span>
                    <span style={{ fontSize: 11, color: '#71717a' }}>{s.label}</span>
                  </div>
                ))}
              </div>
              {allActivities.length === 0 ? (
                <div style={{ textAlign: 'center', padding: 40, color: '#71717a', fontSize: 13 }}>Aucune activité récente</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {allActivities.map((a, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '14px', background: '#27272a', borderRadius: 10 }}>
                      <div style={{ width: 44, height: 44, borderRadius: 10, background: '#18181b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{a.icon}</div>
                      <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 500, color: '#fff' }}>{a.title}</div><div style={{ fontSize: 12, color: '#71717a', marginTop: 2 }}>{a.desc}</div></div>
                      <span style={{ fontSize: 11, color: '#52525b' }}>{a.time}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
