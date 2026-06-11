'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function SecuritePage() {
  const [health, setHealth] = useState<any>(null);
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    const h = { Authorization: `Bearer ${token}` };
    Promise.all([
      fetch(`${API}/admin/security/health`, { headers: h }).then(r => r.ok ? r.json() : null),
      fetch(`${API}/admin/security/recent`, { headers: h }).then(r => r.ok ? r.json() : { events: [] }),
    ]).then(([hData, rData]) => {
      setHealth(hData);
      setRecentEvents(rData.events || []);
    }).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const score = health?.score ?? 0;
  const scoreLabel = health?.label || '—';
  const scoreColor = score >= 85 ? '#22c55e' : score >= 70 ? '#eab308' : score >= 50 ? '#f97316' : '#ef4444';

  const gaugeBg = (i: number) => {
    const segments = 20;
    const fill = Math.round(score / (100 / segments));
    return i < fill ? scoreColor : '#27272a';
  };

  const SeverityBadge = ({ sev }: { sev: string }) => {
    const map: Record<string, { label: string; color: string; bg: string }> = {
      high: { label: 'Haute', color: '#ef4444', bg: '#ef444420' },
      medium: { label: 'Moyenne', color: '#eab308', bg: '#eab30820' },
      low: { label: 'Basse', color: '#22c55e', bg: '#22c55e20' },
    };
    const s = map[sev] || map.low;
    return <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: s.bg, color: s.color }}>{s.label}</span>;
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#71717a' }}>Analyse de la sécurité...</div>;
  }

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>🛡️ Monitoring Sécurité</h2>
        <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>Surveillance en temps réel de la plateforme et de l'application mobile</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 16, marginBottom: 20, alignItems: 'start' }}>
        {/* Gauge card */}
        <div style={{ background: '#18181b', borderRadius: 12, padding: 24, border: '1px solid #27272a', textAlign: 'center' }}>
          <div style={{ fontSize: 11, color: '#71717a', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Score sécurité</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 3, marginBottom: 12 }}>
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={i} style={{ width: 12, height: 32, borderRadius: 3, background: gaugeBg(i), transition: 'background 0.5s' }} />
            ))}
          </div>
          <div style={{ fontSize: 36, fontWeight: 700, color: scoreColor }}>{score}</div>
          <div style={{ fontSize: 13, color: scoreColor, marginBottom: 16 }}>{scoreLabel}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <div style={{ background: '#27272a', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ color: '#71717a', marginBottom: 4 }}>Échecs login 24h</div>
              <div style={{ color: health?.metrics?.failedLogins24h > 5 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{health?.metrics?.failedLogins24h ?? 0}</div>
            </div>
            <div style={{ background: '#27272a', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ color: '#71717a', marginBottom: 4 }}>Erreurs 7j</div>
              <div style={{ color: health?.metrics?.errorLogs7d > 10 ? '#ef4444' : '#eab308', fontWeight: 600 }}>{health?.metrics?.errorLogs7d ?? 0}</div>
            </div>
            <div style={{ background: '#27272a', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ color: '#71717a', marginBottom: 4 }}>OTP échoués 24h</div>
              <div style={{ color: health?.metrics?.otpFailures24h > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{health?.metrics?.otpFailures24h ?? 0}</div>
            </div>
            <div style={{ background: '#27272a', borderRadius: 8, padding: '10px 12px' }}>
              <div style={{ color: '#71717a', marginBottom: 4 }}>Boutiques suspectes</div>
              <div style={{ color: health?.metrics?.suspiciousStores > 0 ? '#ef4444' : '#22c55e', fontWeight: 600 }}>{health?.metrics?.suspiciousStores ?? 0}</div>
            </div>
          </div>
        </div>

        {/* Alerts + Recommendations */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Recommendations */}
          <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #27272a' }}>
            <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recommandations</h3>
            {health?.recommendations?.length ? health.recommendations.map((r: string, i: number) => (
              <div key={i} style={{ padding: '8px 12px', background: '#27272a', borderRadius: 8, marginBottom: 6, fontSize: 12, color: '#a1a1aa' }}>{r}</div>
            )) : <div style={{ fontSize: 12, color: '#52525b' }}>Aucune recommandation</div>}
          </div>

          {/* Critical alerts */}
          {health?.criticalAlerts?.length > 0 && (
            <div style={{ background: '#18181b', borderRadius: 12, padding: 20, border: '1px solid #ef444440' }}>
              <h3 style={{ fontSize: 13, fontWeight: 600, color: '#ef4444', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Alertes critiques</h3>
              {health.criticalAlerts.map((a: any, i: number) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: '#ef444410', borderRadius: 8, marginBottom: 6, fontSize: 12 }}>
                  <span style={{ color: '#a1a1aa' }}>{a.store || a.detail} — {a.detail}</span>
                  <SeverityBadge sev={a.severity} />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent security events */}
      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Derniers événements sécurité</h3>
          <a href="/super-admin/logs" style={{ fontSize: 12, color: '#a855f7', textDecoration: 'none' }}>Voir tous les logs →</a>
        </div>
        <div style={{ overflow: 'auto', maxHeight: 400 }}>
          {recentEvents.length === 0 ? (
            <div style={{ padding: 40, textAlign: 'center', color: '#71717a', fontSize: 13 }}>Aucun événement récent</div>
          ) : recentEvents.map((e: any, i: number) => {
            const color = e.type === 'security' ? '#ef4444' : e.type === 'error' ? '#ef4444' : e.type === 'warning' ? '#eab308' : '#71717a';
            return (
              <div key={e.id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 20px', borderBottom: '1px solid #27272a' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color, marginTop: 4, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12, color: '#a1a1aa' }}>{e.message}</div>
                  <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>
                    {e.source && <span>{e.source} · </span>}
                    {e.ip && <span>IP: {e.ip} · </span>}
                    {e.date && <span>{new Date(e.date).toLocaleString('fr-FR')}</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
