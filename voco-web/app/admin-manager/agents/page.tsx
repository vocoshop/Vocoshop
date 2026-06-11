'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function ManagerAgents() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0 });
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [filterCity, setFilterCity] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterScore, setFilterScore] = useState('');
  const [actionModal, setActionModal] = useState<any>(null);
  const [showFilters, setShowFilters] = useState(false);

  const uniqueCities = useMemo(() => [...new Set(agents.map((a: any) => a.city || a.region).filter(Boolean))].sort(), [agents]);

  const filtered = useMemo(() => agents.filter(a => {
    if (filterCity && (a.city || a.region) !== filterCity) return false;
    if (filterStatus === 'active' && !a.isActive) return false;
    if (filterStatus === 'inactive' && a.isActive) return false;
    if (filterScore === 'excellent' && (a.score || 0) < 80) return false;
    if (filterScore === 'correct' && ((a.score || 0) < 60 || (a.score || 0) >= 80)) return false;
    if (filterScore === 'surveiller' && ((a.score || 0) < 40 || (a.score || 0) >= 60)) return false;
    if (filterScore === 'critique' && (a.score || 0) >= 40) return false;
    return true;
  }), [agents, filterCity, filterStatus, filterScore]);

  const fetchAgents = async (p: number, q: string) => {
    setLoading(true);
    try {
      const token = localStorage.getItem('managerToken');
      const h = { Authorization: `Bearer ${token}` };
      const res = await fetch(`${API}/admin-manager/agents?page=${p}&limit=50&q=${encodeURIComponent(q)}`, { headers: h });
      const data = await res.json();
      setAgents(data.agents || []);
      setMeta(data.meta || { page: 1, limit: 50, total: 0 });
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    const token = localStorage.getItem('managerToken');
    if (!token) { router.push('/manager-login'); return; }
    fetchAgents(1, '');
  }, []);

  const handleSuspend = async (id: string) => {
    try {
      const token = localStorage.getItem('managerToken');
      await fetch(`${API}/admin-manager/agents/${id}/suspend`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      setActionModal(null);
      fetchAgents(page, query);
    } catch {}
  };

  const handleUnsuspend = async (id: string) => {
    try {
      const token = localStorage.getItem('managerToken');
      await fetch(`${API}/admin-manager/agents/${id}/unsuspend`, { method: 'PATCH', headers: { Authorization: `Bearer ${token}` } });
      setActionModal(null);
      fetchAgents(page, query);
    } catch {}
  };

  const scoreStyle = (s: number) => ({
    padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
    background: s >= 80 ? '#22c55e20' : s >= 60 ? '#eab30820' : s >= 40 ? '#f9731620' : '#ef444420',
    color: s >= 80 ? '#22c55e' : s >= 60 ? '#eab308' : s >= 40 ? '#f97316' : '#ef4444',
  });

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>Agents <span style={{ fontSize: 13, color: '#71717a', fontWeight: 400 }}>({filtered.length})</span></h1>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input placeholder="Rechercher..." value={query} onChange={e => { setQuery(e.target.value); fetchAgents(1, e.target.value); }} style={{ padding: '8px 12px', background: '#111113', border: '1px solid #1a1a1e', borderRadius: 8, color: '#fff', fontSize: 13, outline: 'none', width: 200 }} />
          <button onClick={() => setShowFilters(!showFilters)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #1a1a1e', background: showFilters ? '#27272a' : '#111113', color: '#a1a1aa', cursor: 'pointer', fontSize: 12 }}>
            {showFilters ? '✕ Filtres' : '🔽 Filtres'}
          </button>
          <button onClick={() => {
            const rows = [['Code', 'Nom', 'Téléphone', 'Ville', 'Région', 'Score', 'Statut', 'Boutiques', 'Actives', 'Abonnements']];
            filtered.forEach((a: any) => rows.push([a.code, a.name, a.phone, a.city||'', a.region||'', a.score??'', a.isActive ? 'Actif' : 'Inactif', a.stores??0, a.activeStores??0, a.subscriptions??0]));
            const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
            const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a'); a.href = url; a.download = `agents_${new Date().toISOString().slice(0,10)}.csv`; a.click();
            URL.revokeObjectURL(url);
          }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#111113', color: '#a1a1aa', cursor: 'pointer', fontSize: 12 }}>
            📥 CSV
          </button>
        </div>
      </div>

      {/* Filtres avancés */}
      {showFilters && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16, padding: 12, background: '#111113', borderRadius: 8, border: '1px solid #1a1a1e' }}>
          <select value={filterCity} onChange={e => setFilterCity(e.target.value)} style={{ padding: '6px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            <option value="">Toutes les villes</option>
            {uniqueCities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ padding: '6px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            <option value="">Tous les statuts</option>
            <option value="active">Actifs</option>
            <option value="inactive">Inactifs</option>
          </select>
          <select value={filterScore} onChange={e => setFilterScore(e.target.value)} style={{ padding: '6px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 6, color: '#fff', fontSize: 12, cursor: 'pointer' }}>
            <option value="">Tous les scores</option>
            <option value="excellent">🟢 Excellent (80-100)</option>
            <option value="correct">🟡 Correct (60-79)</option>
            <option value="surveiller">🟠 À surveiller (40-59)</option>
            <option value="critique">🔴 Critique (0-39)</option>
          </select>
          {(filterCity || filterStatus || filterScore) && (
            <button onClick={() => { setFilterCity(''); setFilterStatus(''); setFilterScore(''); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: 11 }}>
              Réinitialiser
            </button>
          )}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#71717a', fontSize: 13 }}>Chargement...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#52525b', fontSize: 14 }}>Aucun agent trouvé</div>
      ) : (
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
            <thead><tr style={{ borderBottom: '1px solid #1a1a1e', background: '#0a0a0c' }}>
              {['Agent', 'Code', 'Région', 'Boutiques', 'Actives', 'Abonnements', 'Commission', 'Score', 'Statut', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {filtered.map((a: any) => (
                <tr key={a._id} style={{ borderBottom: '1px solid #1a1a1e' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff', flexShrink: 0 }}>{(a.name || a.firstName || 'A')[0]}</div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{a.name || [a.firstName, a.lastName].filter(Boolean).join(' ')}</div>
                        <div style={{ fontSize: 11, color: '#52525b' }}>{a.phone}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a855f7', fontWeight: 500, fontFamily: 'monospace' }}>{a.code}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{a.city || a.region || '-'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#fff', fontWeight: 600 }}>{a.total}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#22c55e', fontWeight: 600 }}>{a.active}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{a.active}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#facc15', fontWeight: 600 }}>{(a.active * 800).toLocaleString()} FCFA</td>
                  <td style={{ padding: '10px 14px' }}><span style={scoreStyle(a.score)}>{a.score}% · {a.label}</span></td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: a.isActive ? '#22c55e20' : '#ef444420', color: a.isActive ? '#22c55e' : '#ef4444' }}>
                      {a.isActive ? '🟢 Actif' : '🔴 Inactif'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => router.push(`/admin-manager/agents/${a._id}`)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #27272a', background: 'transparent', color: '#a1a1aa', fontSize: 11, cursor: 'pointer' }}>👁️</button>
                      <button onClick={() => setActionModal(a)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #27272a', background: 'transparent', color: a.isActive ? '#ef4444' : '#22c55e', fontSize: 11, cursor: 'pointer' }}>{a.isActive ? '⛔' : '✅'}</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {meta.total > meta.limit && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => { const p = Math.max(1, page - 1); setPage(p); fetchAgents(p, query); }} disabled={page <= 1} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: '#111113', color: page <= 1 ? '#52525b' : '#fff', cursor: page <= 1 ? 'default' : 'pointer', fontSize: 12 }}>← Précédent</button>
          <span style={{ padding: '8px 16px', color: '#71717a', fontSize: 12 }}>Page {meta.page} / {Math.ceil(meta.total / meta.limit)}</span>
          <button onClick={() => { const p = page + 1; setPage(p); fetchAgents(p, query); }} disabled={page >= Math.ceil(meta.total / meta.limit)} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: '#111113', color: page >= Math.ceil(meta.total / meta.limit) ? '#52525b' : '#fff', cursor: page >= Math.ceil(meta.total / meta.limit) ? 'default' : 'pointer', fontSize: 12 }}>Suivant →</button>
        </div>
      )}

      {/* Action Modal */}
      {actionModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setActionModal(null)}>
          <div style={{ background: '#111113', borderRadius: 12, padding: 24, width: '90%', maxWidth: 360, border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 15, fontWeight: 600, color: '#fff', margin: '0 0 8px' }}>Confirmer l'action</h3>
            <p style={{ fontSize: 13, color: '#71717a', marginBottom: 20 }}>Voulez-vous {actionModal.isActive ? 'suspendre' : 'réactiver'} <strong style={{ color: '#fff' }}>{actionModal.name || actionModal.code}</strong> ?</p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setActionModal(null)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #27272a', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={() => actionModal.isActive ? handleSuspend(actionModal._id) : handleUnsuspend(actionModal._id)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: actionModal.isActive ? '#ef4444' : '#22c55e', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                {actionModal.isActive ? 'Suspendre' : 'Réactiver'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
