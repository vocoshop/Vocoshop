'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function AnalyticsPage() {
  const [stats, setStats] = useState<any>({});
  const [stores, setStores] = useState<any[]>([]);
  const [activityDays, setActivityDays] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) return;
    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const [sr, str, act] = await Promise.all([
          fetch(`${API}/admin/stats`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/stores?limit=500`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/activity-stats?days=30`, { headers: h }).catch(() => null),
        ]);
        if (sr?.ok) setStats(await sr.json());
        if (str?.ok) setStores((await str.json()).stores || []);
        if (act?.ok) setActivityDays((await act.json()).days || []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', height: '40vh', alignItems: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;

  const sub = stats.subscription || {};
  const agents = stats.agents || {};
  const topCities = stats.topCities || [];
  const totalStores = stats.stores?.total || stores.length;
  const active = sub.active || 0;
  const trial = sub.trial || 0;
  const grace = sub.grace || 0;
  const expired = sub.expired || 0;
  const unused = sub.unused || 0;
  const revenue = active * 3900;
  const maxCityCount = Math.max(...topCities.map((c: any) => c.count), 1);

  const subscriptionData = [
    { label: 'Actifs', value: active, color: '#22c55e', pct: totalStores > 0 ? Math.round((active / totalStores) * 100) : 0 },
    { label: 'Trial', value: trial, color: '#eab308', pct: totalStores > 0 ? Math.round((trial / totalStores) * 100) : 0 },
    { label: 'Grace', value: grace, color: '#3b82f6', pct: totalStores > 0 ? Math.round((grace / totalStores) * 100) : 0 },
    { label: 'Expirés', value: expired, color: '#ef4444', pct: totalStores > 0 ? Math.round((expired / totalStores) * 100) : 0 },
    { label: 'Inactifs', value: unused, color: '#71717a', pct: totalStores > 0 ? Math.round((unused / totalStores) * 100) : 0 },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>📊 Analytics</h2>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>Statistiques et indicateurs clés de la plateforme</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 }}>
        <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #27272a' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Répartition abonnements</h3>
          {subscriptionData.map(d => (
            <div key={d.label} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#a1a1aa' }}>{d.label}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: d.color }}>{d.value} ({d.pct}%)</span>
              </div>
              <div style={{ width: '100%', height: 8, borderRadius: 4, background: '#27272a', overflow: 'hidden' }}>
                <div style={{ width: `${d.pct}%`, height: '100%', borderRadius: 4, background: d.color, transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #27272a' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Vue d'ensemble</h3>
          {[
            { label: 'Boutiques totales', value: totalStores, color: '#a855f7' },
            { label: 'Taux conversion actif', value: totalStores > 0 ? `${Math.round((active / totalStores) * 100)}%` : '0%', color: '#22c55e' },
            { label: 'Revenu moyen/boutique', value: totalStores > 0 ? `${Math.round(revenue / totalStores)} XAF` : '0 XAF', color: '#eab308' },
            { label: 'Agents actifs', value: agents.active || 0, color: '#3b82f6' },
            { label: 'Agents total', value: agents.total || 0, color: '#71717a' },
          ].map(s => (
            <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #27272a' }}>
              <span style={{ fontSize: 12, color: '#71717a' }}>{s.label}</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>

        <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #27272a' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Top villes</h3>
          {topCities.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 20, color: '#71717a', fontSize: 12 }}>Aucune donnée</div>
          ) : topCities.slice(0, 6).map((c: any) => (
            <div key={c._id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: '#a1a1aa' }}>{c._id}</span>
                <span style={{ fontSize: 12, color: '#22c55e' }}>{c.count}</span>
              </div>
              <div style={{ width: '100%', height: 6, borderRadius: 3, background: '#27272a', overflow: 'hidden' }}>
                <div style={{ width: `${(c.count / maxCityCount) * 100}%`, height: '100%', borderRadius: 3, background: '#a855f7', transition: 'width 0.5s' }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #27272a' }}>
        <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 16 }}>Activité quotidienne (30 jours)</h3>
        {activityDays.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 20, color: '#71717a', fontSize: 12 }}>Aucune activité récente</div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', height: 120, gap: 2 }}>
              {activityDays.map((d: any) => {
                const maxActivity = Math.max(...activityDays.map((x: any) => x.activity), 1);
                const h = Math.max(3, Math.round((d.activity / maxActivity) * 120));
                const isToday = d.day === new Date().toISOString().split('T')[0];
                return (
                  <div key={d.day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }} title={`${d.label}: ${d.activity} action(s), ${d.stores} boutique(s)`}>
                    <div style={{ height: `${h}px`, width: '100%', borderRadius: '3px 3px 0 0', background: isToday ? '#a855f7' : d.activity > 0 ? '#a855f780' : '#27272a', transition: 'height 0.3s' }} />
                    {d.stores > 0 && <div style={{ width: 4, height: 4, borderRadius: '50%', background: '#22c55e' }} />}
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 8, fontSize: 9, color: '#52525b' }}>
              <span>{activityDays[0]?.label}</span>
              <span>{activityDays[Math.floor(activityDays.length / 2)]?.label}</span>
              <span>{activityDays[activityDays.length - 1]?.label}</span>
            </div>
          </>
        )}
      </div>

    </div>
  );
}
