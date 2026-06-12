'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const scoreColor = (s: number) => s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : s >= 40 ? '#f97316' : '#ef4444';

export default function ComparerPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [a1, setA1] = useState<any>(null);
  const [a2, setA2] = useState<any>(null);
  const [d1, setD1] = useState<string>('');
  const [d2, setD2] = useState<string>('');

  const token = typeof window !== 'undefined' ? localStorage.getItem('managerToken') : null;
  const headers = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    if (!token) { router.push('/manager-login'); return; }
    fetch(`${API}/admin-manager/agents?limit=100`, { headers })
      .then(r => r.json()).then(d => setAgents(Array.isArray(d?.agents) ? d.agents : [])).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const loadAgent = async (id: string, slot: 1 | 2) => {
    try {
      const r = await fetch(`${API}/admin-manager/agents/${id}`, { headers });
      const d = await r.json();
      if (slot === 1) { setA1(d.agent || d); setD1(id); }
      else { setA2(d.agent || d); setD2(id); }
    } catch {}
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  const Card = ({ agent, side }: { agent: any; side: 1 | 2 }) => {
    const selectedId = side === 1 ? d1 : d2;
    return (
      <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 20 }}>
        <select value={selectedId} onChange={e => loadAgent(e.target.value, side)} style={{ width: '100%', padding: '8px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 6, color: '#fff', fontSize: 13, marginBottom: 16, outline: 'none', cursor: 'pointer' }}>
          <option value="">Sélectionner un agent...</option>
          {agents.map((a: any) => (
            <option key={a._id} value={a._id} disabled={a._id === (side === 1 ? d2 : d1)}>
              {a.name || a.code} ({a.code}) — {a.score || 0}%
            </option>
          ))}
        </select>

        {agent ? (
          <div>
            <div style={{ textAlign: 'center', marginBottom: 16 }}>
              <div style={{ width: 48, height: 48, borderRadius: 12, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 auto 8px' }}>{(agent.name || 'A')[0]}</div>
              <div style={{ fontSize: 16, fontWeight: 700, color: '#fff' }}>{agent.name || agent.code}</div>
              <div style={{ fontSize: 12, color: '#71717a' }}>{agent.code}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 16 }}>
              <span style={{ padding: '4px 16px', borderRadius: 20, fontSize: 14, fontWeight: 700, background: `${scoreColor(agent.score || 0)}20`, color: scoreColor(agent.score || 0) }}>{agent.score || 0}%</span>
            </div>

            {[
              ['Boutiques créées', agent.stores ?? agent.total ?? 0],
              ['Abonnements actifs', agent.activeStores ?? agent.active ?? 0],
              ['Taux activation', agent.stores ? `${Math.round(((agent.activeStores ?? agent.active ?? 0) / agent.stores) * 100)}%` : '0%'],
              ['Commission', `${(agent.totalCommissions || 0).toLocaleString()} FCFA`],
              ['Statut', agent.isActive ? 'Actif' : 'Inactif'],
              ['Ville', agent.city || '—'],
              ['Région', agent.region || '—'],
              ['Téléphone', agent.phone || '—'],
              ['Dernière connexion', agent.lastLoginAt ? new Date(agent.lastLoginAt).toLocaleDateString('fr-FR') : 'Jamais'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #0a0a0c', fontSize: 12 }}>
                <span style={{ color: '#71717a' }}>{k}</span>
                <span style={{ color: '#fff', fontWeight: 500 }}>{v}</span>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 40, color: '#52525b', fontSize: 13 }}>
            Sélectionnez un agent pour voir ses stats
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Comparer des agents</h1>

      {a1 && a2 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', gap: 12, marginBottom: 20, alignItems: 'start' }}>
          <Card agent={a1} side={1} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingTop: 120 }}>
            {[
              { label: 'Score', v1: a1.score || 0, v2: a2.score || 0 },
              { label: 'Boutiques', v1: a1.stores ?? a1.total ?? 0, v2: a2.stores ?? a2.total ?? 0 },
              { label: 'Actives', v1: a1.activeStores ?? a1.active ?? 0, v2: a2.activeStores ?? a2.active ?? 0 },
              { label: 'Commission', v1: a1.totalCommissions || 0, v2: a2.totalCommissions || 0 },
            ].map(({ label, v1, v2 }) => {
              const w1 = v1 > v2 ? 'bold' : 'normal';
              const w2 = v2 > v1 ? 'bold' : 'normal';
              const c1 = v1 >= v2 ? '#22c55e' : '#ef4444';
              const c2 = v2 >= v1 ? '#22c55e' : '#ef4444';
              return (
                <div key={label} style={{ textAlign: 'center', padding: '4px 8px', background: '#0a0a0c', borderRadius: 6 }}>
                  <div style={{ fontSize: 9, color: '#52525b', marginBottom: 2 }}>{label}</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', fontSize: 12 }}>
                    <span style={{ fontWeight: w1, color: c1 }}>{typeof v1 === 'number' && label === 'Commission' ? `${v1.toLocaleString()} FCFA` : v1}</span>
                    <span style={{ color: '#52525b' }}>vs</span>
                    <span style={{ fontWeight: w2, color: c2 }}>{typeof v2 === 'number' && label === 'Commission' ? `${v2.toLocaleString()} FCFA` : v2}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <Card agent={a2} side={2} />
        </div>
      )}

      {(!a1 || !a2) && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Card agent={a1} side={1} />
          <Card agent={a2} side={2} />
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
