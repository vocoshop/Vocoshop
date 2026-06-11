'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

const severityOrder: Record<string, number> = { '🔴': 0, '🟠': 1, '🟡': 2 };
const severityLabels: Record<string, string> = { '🔴': 'Urgent', '🟠': 'Important', '🟡': 'Modéré' };
const severityColors: Record<string, string> = { '🔴': '#ef4444', '🟠': '#f97316', '🟡': '#eab308' };

export default function AlertesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem('managerToken');
    if (!token) { router.push('/manager-login'); return; }
    const h = { Authorization: `Bearer ${token}` };
    fetch(`${API}/admin-manager/alerts`, { headers: h })
      .then(r => r.json()).then(d => setAlerts(Array.isArray(d?.alerts) ? d.alerts : Array.isArray(d) ? d : []))
      .catch(() => {}).finally(() => setLoading(false));
  }, []);

  const grouped: Record<string, any[]> = { '🔴': [], '🟠': [], '🟡': [] };
  for (const a of alerts) {
    const sv = a.severity || '🟡';
    if (grouped[sv]) grouped[sv].push(a);
    else grouped['🟡'].push(a);
  }

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ marginTop: 16, fontSize: 14 }}>Chargement des alertes...</p>
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Alertes terrain</h1>

      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 64, color: '#52525b', fontSize: 14 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>🎉</div>
          Aucune alerte pour le moment
        </div>
      ) : (
        Object.entries(grouped).map(([severity, items]) => {
          if (items.length === 0) return null;
          return (
            <div key={severity} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontSize: 18 }}>{severity}</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: severityColors[severity] }}>{severityLabels[severity]}</span>
                <span style={{ fontSize: 12, color: '#52525b', background: '#1a1a1e', padding: '2px 8px', borderRadius: 10 }}>{items.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {items.map((a: any, i: number) => (
                  <div key={a._id || i} style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px',
                    background: '#111113', borderRadius: 10, border: '1px solid #1a1a1e',
                    transition: 'background 0.15s',
                  }}>
                    <span style={{ fontSize: 22 }}>{a.severity || severity}</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 500, color: '#fff', marginBottom: 2 }}>{a.label || 'Alerte'}</div>
                      <div style={{ fontSize: 12, color: '#71717a' }}>{a.agent || a.agentName || 'Agent inconnu'}</div>
                    </div>
                    <button onClick={() => router.push(`/admin-manager/agents/${a.agentId}`)} style={{
                      padding: '7px 16px', borderRadius: 6, border: '1px solid #27272a',
                      background: 'transparent', color: '#a855f7', fontSize: 12, cursor: 'pointer',
                      whiteSpace: 'nowrap', transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = '#a855f720'; (e.currentTarget as HTMLElement).style.borderColor = '#a855f7'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.borderColor = '#27272a'; }}
                    >Ouvrir</button>
                  </div>
                ))}
              </div>
            </div>
          );
        })
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
