'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function AgentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [agent, setAgent] = useState<any>(null);
  const [stores, setStores] = useState<any[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);
  const [dailyActivity, setDailyActivity] = useState<any[]>([]);
  const [monthlySubs, setMonthlySubs] = useState<any[]>([]);
  const [installByWeek, setInstallByWeek] = useState<any[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [showLogs, setShowLogs] = useState(false);
  const [logsLoading, setLogsLoading] = useState(false);
  const [scoreEvolution, setScoreEvolution] = useState<any[]>([]);
  const [showScoreEvolution, setShowScoreEvolution] = useState(false);
  const [suspendModal, setSuspendModal] = useState(false);
  const [resetModal, setResetModal] = useState(false);
  const [messageModal, setMessageModal] = useState(false);
  const [messageText, setMessageText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchAgent = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('managerToken');
      if (!token) { router.push('/manager-login'); return; }
      const res = await fetch(`${API}/admin-manager/agents/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      setAgent(data.agent || data);
      if (data.stores) setStores(data.stores);
      if (data.charts?.dailyActivity) setDailyActivity(data.charts.dailyActivity);
      if (data.charts?.monthlySubscriptions) setMonthlySubs(data.charts.monthlySubscriptions);
      if (data.charts?.installByWeek) setInstallByWeek(data.charts.installByWeek);
      if (data.charts?.weeklyActivity) setWeeklyActivity(data.charts.weeklyActivity);
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    const token = localStorage.getItem('managerToken');
    if (!token) { router.push('/manager-login'); return; }
    if (id) fetchAgent();
  }, [id]);

  const handleToggleStatus = async () => {
    try {
      const token = localStorage.getItem('managerToken');
      const endpoint = agent.isActive ? 'suspend' : 'unsuspend';
      await fetch(`${API}/admin-manager/agents/${id}/${endpoint}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
      });
      setSuspendModal(false);
      fetchAgent();
    } catch {}
  };

  const handleResetPassword = async () => {
    try {
      const token = localStorage.getItem('managerToken');
      await fetch(`${API}/admin-manager/agents/${id}/reset-password`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      setResetModal(false);
    } catch {}
  };

  const handleSendMessage = async () => {
    if (!messageText.trim()) return;
    setSending(true);
    try {
      const token = localStorage.getItem('managerToken');
      await fetch(`${API}/admin-manager/agents/${id}/message`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: messageText }),
      });
      setMessageText('');
      setMessageModal(false);
    } catch {} finally { setSending(false); }
  };

  const loadLogs = async () => {
    if (logs.length > 0) { setShowLogs(!showLogs); return; }
    setLogsLoading(true);
    setShowLogs(true);
    try {
      const token = localStorage.getItem('managerToken');
      const r = await fetch(`${API}/admin-manager/agents/${id}/logs?limit=100`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setLogs(d.logs || []);
    } catch {} finally { setLogsLoading(false); }
  };

  const loadScoreEvolution = async () => {
    if (scoreEvolution.length > 0) { setShowScoreEvolution(!showScoreEvolution); return; }
    setShowScoreEvolution(true);
    try {
      const token = localStorage.getItem('managerToken');
      const r = await fetch(`${API}/admin-manager/agents/${id}/score-evolution`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const d = await r.json();
      setScoreEvolution(d.evolution || []);
    } catch {}
  };

  const formatDate = (d: string) => {
    if (!d) return '-';
    try { return new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return d; }
  };

  const formatDateTime = (d: string) => {
    if (!d) return 'Jamais';
    try { return new Date(d).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }); } catch { return d; }
  };

  const scoreColor = (s: number) => s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : s >= 40 ? '#f97316' : '#ef4444';
  const scoreLabel = (s: number) => s >= 80 ? 'Excellent' : s >= 60 ? 'Correct' : s >= 40 ? 'À surveiller' : 'Critique';

  const maxBar = 7;

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
        <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
        <p style={{ marginTop: 16, fontSize: 14 }}>Chargement de l'agent...</p>
      </div>
    );
  }

  if (!agent) {
    return (
      <div style={{ textAlign: 'center', padding: 60, color: '#52525b', fontSize: 14 }}>
        Agent introuvable
      </div>
    );
  }

  const initials = (agent.name || [agent.firstName, agent.lastName].filter(Boolean).join(' ') || 'A')
    .split(' ').map((s: string) => s[0]).join('').toUpperCase().slice(0, 2);


  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {/* Top Section */}
      <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 24, marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, flexWrap: 'wrap' }}>
          <div style={{ width: 72, height: 72, borderRadius: 16, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26, fontWeight: 700, color: '#fff', flexShrink: 0 }}>
            {initials}
          </div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>{agent.name || [agent.firstName, agent.lastName].filter(Boolean).join(' ')}</h1>
              <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: agent.isActive ? '#22c55e20' : '#ef444420', color: agent.isActive ? '#22c55e' : '#ef4444' }}>
                {agent.isActive ? 'Actif' : 'Inactif'}
              </span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, marginTop: 10 }}>
              <div style={{ fontSize: 13, color: '#a1a1aa' }}><span style={{ color: '#52525b' }}>Code :</span> <span style={{ color: '#a855f7', fontFamily: 'monospace', fontWeight: 500 }}>{agent.code}</span></div>
              <div style={{ fontSize: 13, color: '#a1a1aa' }}><span style={{ color: '#52525b' }}>Téléphone :</span> {agent.phone || '-'}</div>
              <div style={{ fontSize: 13, color: '#a1a1aa' }}><span style={{ color: '#52525b' }}>Ville :</span> {agent.city || agent.region || '-'}</div>
              <div style={{ fontSize: 13, color: '#a1a1aa' }}><span style={{ color: '#52525b' }}>Inscrit le :</span> {formatDate(agent.createdAt)}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 20 }}>
        <a href={`tel:${agent.phone}`} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: '#111113', color: '#fff', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          📞 Appeler
        </a>
        <a href={`https://wa.me/${agent.phone?.replace(/\s/g, '')}`} target="_blank" rel="noopener noreferrer" style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: '#111113', color: '#fff', fontSize: 12, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          💬 WhatsApp
        </a>
        <button onClick={() => setSuspendModal(true)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: '#111113', color: agent.isActive ? '#ef4444' : '#22c55e', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          {agent.isActive ? '⛔ Suspendre' : '✅ Réactiver'}
        </button>
        <button onClick={() => setMessageModal(true)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: '#111113', color: '#fff', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          ✉️ Envoyer message
        </button>
        <button onClick={() => setResetModal(true)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: '#111113', color: '#eab308', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          🔑 Reset mot de passe
        </button>
        <button onClick={loadLogs} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: showLogs ? '#a855f720' : '#111113', color: '#a1a1aa', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          📋 Logs activité
        </button>
        <button onClick={loadScoreEvolution} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: showScoreEvolution ? '#a855f720' : '#111113', color: '#a1a1aa', fontSize: 12, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          📈 Évolution score
        </button>
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
        <div style={{ background: '#111113', borderRadius: 12, padding: '18px 20px', border: '1px solid #1a1a1e' }}>
          <div style={{ fontSize: 11, color: '#52525b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Boutiques créées</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{agent.total ?? agent.stores?.total ?? 0}</div>
        </div>
        <div style={{ background: '#111113', borderRadius: 12, padding: '18px 20px', border: '1px solid #1a1a1e' }}>
          <div style={{ fontSize: 11, color: '#52525b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Boutiques actives</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#22c55e' }}>{agent.active ?? agent.stores?.active ?? 0}</div>
        </div>
        <div style={{ background: '#111113', borderRadius: 12, padding: '18px 20px', border: '1px solid #1a1a1e' }}>
          <div style={{ fontSize: 11, color: '#52525b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Abonnements activés</div>
          <div style={{ fontSize: 28, fontWeight: 700, color: '#3b82f6' }}>{agent.activeSubscriptions ?? agent.subscriptions?.active ?? 0}</div>
        </div>
        <div style={{ background: '#111113', borderRadius: 12, padding: '18px 20px', border: '1px solid #1a1a1e' }}>
          <div style={{ fontSize: 11, color: '#52525b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Score qualité</div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontSize: 28, fontWeight: 700, color: scoreColor(agent.score ?? 0) }}>{agent.score ?? 0}%</span>
            <span style={{ fontSize: 11, color: scoreColor(agent.score ?? 0) }}>{scoreLabel(agent.score ?? 0)}</span>
          </div>
        </div>
        <div style={{ background: '#111113', borderRadius: 12, padding: '18px 20px', border: '1px solid #1a1a1e' }}>
          <div style={{ fontSize: 11, color: '#52525b', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Dernière connexion</div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#a1a1aa' }}>{formatDateTime(agent.lastLoginAt)}</div>
        </div>
      </div>

      {/* 4 GRAPHIQUES SVG */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        {/* Activité quotidienne (30j) */}
        <ChartCard title="Activité quotidienne (30 jours)" data={dailyActivity} color="#a855f7" gradient />
        {/* Installations par semaine */}
        <ChartCard title="Installations par semaine (90 jours)" data={installByWeek} color="#3b82f6" gradient />
        {/* Abonnements par mois */}
        <ChartCard title="Abonnements activés par mois" data={monthlySubs} color="#22c55e" />
        {/* Croissance réseau */}
        <ChartCard title="Croissance du réseau" data={[...dailyActivity].reverse()} color="#facc15" />
      </div>

      {/* Stores Table */}
      <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', overflow: 'hidden', marginBottom: 24 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1a1a1e' }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>Boutiques de l'agent</h3>
        </div>
        {(!stores || stores.length === 0) ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#52525b', fontSize: 13 }}>Aucune boutique</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 500 }}>
              <thead><tr style={{ borderBottom: '1px solid #1a1a1e', background: '#0a0a0c' }}>
                {['Nom', 'Téléphone', 'Ville', 'Abonnement', 'Dernière activité', 'Statut'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '9px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {stores.map((s: any, i: number) => (
                  <tr key={s._id || i} style={{ borderBottom: '1px solid #1a1a1e' }}>
                    <td style={{ padding: '9px 14px', fontSize: 13, fontWeight: 500 }}><Link href={`/admin-manager/boutiques/${s._id}`} style={{ color: '#a855f7', textDecoration: 'none' }}>{s.name || s.storeName || '-'}</Link></td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: '#a1a1aa' }}>{s.phone || '-'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: '#a1a1aa' }}>{s.city || s.region || '-'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: s.subscription || s.isSubscribed ? '#22c55e' : '#71717a' }}>{s.subscription || s.isSubscribed ? '✅ Actif' : '❌ Aucun'}</td>
                    <td style={{ padding: '9px 14px', fontSize: 12, color: '#a1a1aa' }}>{formatDate(s.lastActiveAt || s.lastActivity)}</td>
                    <td style={{ padding: '9px 14px' }}>
                      <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: s.isActive !== false ? '#22c55e20' : '#ef444420', color: s.isActive !== false ? '#22c55e' : '#ef4444' }}>
                        {s.isActive !== false ? 'Actif' : 'Inactif'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Activity Logs */}
      {showLogs && (
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', overflow: 'hidden', marginBottom: 24 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid #1a1a1e' }}>
            <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: 0 }}>
              Logs d'activité {logsLoading && <span style={{ fontSize: 11, color: '#71717a', fontWeight: 400 }}>chargement...</span>}
              <span style={{ fontSize: 11, color: '#52525b', fontWeight: 400, marginLeft: 8 }}>({logs.length})</span>
            </h3>
          </div>
          {logs.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#52525b', fontSize: 13 }}>{logsLoading ? 'Chargement...' : 'Aucun log'}</div>
          ) : (
            <div style={{ maxHeight: 320, overflowY: 'auto' }}>
              {logs.map((l: any, i: number) => {
                const icon: Record<string, string> = { login: '🔑', commission_earned: '💰', store_created: '🏪', store_activated: '✅', store_expired: '❌', password_reset: '🔐', message: '📩' };
                return (
                  <div key={l._id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 16px', borderBottom: '1px solid #0a0a0c' }}>
                    <span style={{ fontSize: 14 }}>{icon[l.type] || '📋'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 12, color: '#d4d4d8', lineHeight: 1.4 }}>{l.message || l.type}</div>
                      <div style={{ fontSize: 10, color: '#52525b', marginTop: 2 }}>{new Date(l.createdAt).toLocaleString('fr-FR')}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Score Evolution */}
      {showScoreEvolution && scoreEvolution.length > 0 && (
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 16, marginBottom: 24 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 14px' }}>Évolution du score (8 semaines)</h3>
          <svg width="100%" height="120" viewBox="0 0 600 120" style={{ display: 'block' }}>
            <defs>
              <linearGradient id="scoreGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a855f7" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#a855f7" stopOpacity="0.02" />
              </linearGradient>
            </defs>
            {[0, 25, 50, 75, 100].map(v => {
              const y = 110 - (v / 100) * 95;
              return <g key={v}><line x1="40" y1={y} x2="590" y2={y} stroke="#1a1a1e" strokeWidth="1" /><text x="36" y={y + 3} textAnchor="end" fill="#52525b" fontSize="8">{v}</text></g>;
            })}
            {(() => {
              const maxScore = Math.max(...scoreEvolution.map((s: any) => s.score), 1);
              const pts = scoreEvolution.map((s: any, i: number) => ({
                x: 40 + (i / (scoreEvolution.length - 1)) * 550,
                y: 110 - (s.score / 100) * 95,
                score: s.score,
                stores: s.stores,
                active: s.active,
                label: s.label,
              }));
              const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
              const areaD = pts.length > 0 ? `${d}L${pts[pts.length-1].x},110L${pts[0].x},110Z` : '';
              return <>
                <path d={areaD} fill="url(#scoreGrad)" />
                <path d={d} fill="none" stroke="#a855f7" strokeWidth="2" strokeLinejoin="round" />
                {pts.map((p, i) => (
                  <g key={i}>
                    <title>{`Score: ${p.score}% | Boutiques: ${p.stores} | Actives: ${p.active}`}</title>
                    <circle cx={p.x} cy={p.y} r="3" fill="#a855f7" stroke="#111113" strokeWidth="1.5" />
                  </g>
                ))}
                {scoreEvolution.map((s: any, i: number) => {
                  if (scoreEvolution.length <= 6 || i % 2 === 0 || i === scoreEvolution.length - 1) {
                    return <text key={i} x={40 + (i / (scoreEvolution.length - 1)) * 550} y="117" textAnchor="middle" fill="#52525b" fontSize="7">{s.label}</text>;
                  }
                  return null;
                })}
              </>;
            })()}
          </svg>
        </div>
      )}

      {/* Suspend / Reactivate Modal */}
      {suspendModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setSuspendModal(false)}>
          <div style={{ background: '#111113', borderRadius: 12, padding: 24, width: '90%', maxWidth: 360, border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 8px' }}>Confirmer l'action</h3>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 20 }}>
              Voulez-vous {agent.isActive ? 'suspendre' : 'réactiver'} <strong style={{ color: '#fff' }}>{agent.name || agent.code}</strong> ?
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setSuspendModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #27272a', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={handleToggleStatus} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: agent.isActive ? '#ef4444' : '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {agent.isActive ? 'Suspendre' : 'Réactiver'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resetModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setResetModal(false)}>
          <div style={{ background: '#111113', borderRadius: 12, padding: 24, width: '90%', maxWidth: 360, border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 8px' }}>Réinitialiser le mot de passe</h3>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 20 }}>
              Un nouveau mot de passe sera généré et envoyé à <strong style={{ color: '#fff' }}>{agent.phone}</strong>.
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setResetModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #27272a', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={handleResetPassword} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: '#eab308', color: '#000', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>Confirmer</button>
            </div>
          </div>
        </div>
      )}

      {/* Send Message Modal */}
      {messageModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setMessageModal(false)}>
          <div style={{ background: '#111113', borderRadius: 12, padding: 24, width: '90%', maxWidth: 420, border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 8px' }}>Envoyer un message</h3>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 14 }}>Message à <strong style={{ color: '#fff' }}>{agent.name || agent.code}</strong></p>
            <textarea value={messageText} onChange={e => setMessageText(e.target.value)} placeholder="Écrivez votre message..." rows={4} style={{ width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
            <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
              <button onClick={() => { setMessageModal(false); setMessageText(''); }} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #27272a', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={handleSendMessage} disabled={sending || !messageText.trim()} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: sending || !messageText.trim() ? '#27272a' : '#a855f7', color: sending || !messageText.trim() ? '#52525b' : '#fff', cursor: sending || !messageText.trim() ? 'default' : 'pointer', fontSize: 13, fontWeight: 600 }}>
                {sending ? 'Envoi...' : 'Envoyer'}
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

const WIDTH = 280;
const HEIGHT = 100;
const PAD = { top: 8, right: 8, bottom: 20, left: 28 };

function ChartCard({ title, data, color, gradient }: { title: string; data: any[]; color: string; gradient?: boolean }) {
  if (!data || data.length < 2) {
    return (
      <div style={{ background: '#111113', borderRadius: 10, border: '1px solid #1a1a1e', padding: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 10 }}>{title}</div>
        <div style={{ height: 100, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#52525b', fontSize: 12 }}>Données insuffisantes</div>
      </div>
    );
  }

  const vals = data.map(d => d.count ?? d.value ?? 0);
  const max = Math.max(...vals, 1);
  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;

  const points = vals.map((v, i) => ({
    x: PAD.left + (i / (vals.length - 1)) * plotW,
    y: PAD.top + plotH - (v / max) * plotH,
    v,
  }));

  const d = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

  const gradId = `grad-${title.replace(/\s/g, '')}`;
  const areaD = points.length > 0
    ? `${d}L${points[points.length - 1].x},${PAD.top + plotH}L${points[0].x},${PAD.top + plotH}Z`
    : '';

  return (
    <div style={{ background: '#111113', borderRadius: 10, border: '1px solid #1a1a1e', padding: 14 }}>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 10 }}>{title}</div>
      <svg width={WIDTH} height={HEIGHT} viewBox={`0 0 ${WIDTH} ${HEIGHT}`} style={{ display: 'block' }}>
        {gradient && (
          <defs>
            <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.3" />
              <stop offset="100%" stopColor={color} stopOpacity="0.02" />
            </linearGradient>
          </defs>
        )}
        {gradient && <path d={areaD} fill={`url(#${gradId})`} />}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = PAD.top + plotH - pct * plotH;
          return (
            <g key={pct}>
              <line x1={PAD.left} y1={y} x2={WIDTH - PAD.right} y2={y} stroke="#1a1a1e" strokeWidth="1" />
              <text x={PAD.left - 4} y={y + 3} textAnchor="end" fill="#52525b" fontSize="8">{Math.round(pct * max)}</text>
            </g>
          );
        })}
        <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={2.5} fill={color} stroke="#111113" strokeWidth="1.5" />
        ))}
        {points.length > 0 && points.filter(p => p.v === Math.max(...vals)).slice(-1).map((p, i) => (
          <circle key={`glow-${i}`} cx={p.x} cy={p.y} r={4} fill={color} opacity="0.3" />
        ))}
        {vals.map((_, i) => {
          if (vals.length <= 6 || i % Math.ceil(vals.length / 5) === 0 || i === vals.length - 1) {
            const label = data[i]?._id?.slice(-5) || data[i]?._id || '';
            return (
              <text key={i} x={PAD.left + (i / (vals.length - 1)) * plotW} y={HEIGHT - 4} textAnchor="middle" fill="#52525b" fontSize="7">{label}</text>
            );
          }
          return null;
        })}
      </svg>
    </div>
  );
}
