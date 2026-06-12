'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const agentName = (a: any) => a.name || [a.firstName, a.lastName].filter(Boolean).join(' ') || 'Agent';

export default function AgentsPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [sort, setSort] = useState('name');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type: string) => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) return router.push('/admin/login');
    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const [ar, sr] = await Promise.all([
          fetch(`${API}/admin/agents?approved=true&limit=500`, { headers: h }).catch(() => ({ ok: false, json: () => ({}) })),
          fetch(`${API}/admin/stores?limit=500`, { headers: h }).catch(() => ({ ok: false, json: () => ({ stores: [] }) })),
        ]);
        const ad = await (async () => { try { return await ar.json(); } catch { return { agents: [] }; } })() as any;
        const sd = await (async () => { try { return await sr.json(); } catch { return { stores: [] }; } })();
        if (ar.ok) setAgents(ad.agents || []);
        if (sr.ok) setStores(sd.stores || []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const getAgentStats = (code: string) => {
    const lc = (code || '').toLowerCase();
    const agentStores = stores.filter(s => (s.agentCode || '').toLowerCase() === lc);
    return {
      total: agentStores.length,
      active: agentStores.filter(s => s.subscriptionStatus === 'active').length,
      trial: agentStores.filter(s => s.subscriptionStatus === 'trial').length,
      expired: agentStores.filter(s => s.subscriptionStatus === 'expired').length,
    };
  };

  const enrichedAgents = agents.map(a => {
    const stats = getAgentStats(a.code);
    return { ...a, _stats: stats, _activation: stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 0 };
  });

  const filtered = enrichedAgents
    .filter(a => filter === 'all' || (filter === 'active' ? a.isActive : !a.isActive))
    .filter(a => agentName(a).toLowerCase().includes(search.toLowerCase()) || (a.phone || '').includes(search) || (a.code || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      let va: any, vb: any;
      if (sort === 'stores') { va = a._stats.total; vb = b._stats.total; }
      else if (sort === 'activation') { va = a._activation; vb = b._activation; }
      else { va = agentName(a).toLowerCase(); vb = agentName(b).toLowerCase(); }
      return dir === 'asc' ? (va < vb ? -1 : va > vb ? 1 : 0) : (va > vb ? -1 : va < vb ? 1 : 0);
    });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);

  const exportCSV = () => {
    const headers = ['Nom', 'Code', 'Telephone', 'Ville', 'Pays', 'Boutiques', 'Actives', 'Creation', 'Statut'];
    const rows = filtered.map(a => [
      agentName(a), a.code || '', a.phone || '', a.city || '', a.country || '',
      a._stats.total.toString(), a._stats.active.toString(),
      a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '',
      a.isActive ? 'Actif' : 'Inactif',
    ]);
    const csv = [[headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')];
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agents_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export CSV downloaded', 'success');
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh', color: '#71717a' }}><div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;

  const filters = [
    { key: 'all', label: 'Tous', count: agents.length, color: '#a855f7' },
    { key: 'active', label: 'Actifs', count: agents.filter(a => a.isActive).length, color: '#22c55e' },
    { key: 'inactive', label: 'Inactifs', count: agents.filter(a => !a.isActive).length, color: '#ef4444' },
  ];

  const topAgents = filtered.slice(0, 3);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, background: toast.type === 'success' ? '#22c55e20' : '#ef444420', border: `1px solid ${toast.type === 'success' ? '#22c55e' : '#ef4444'}`, color: toast.type === 'success' ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 500, backdropFilter: 'blur(8px)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>👥 Agents</h2>
          <p style={{ fontSize: 12, color: '#71717a', margin: '4px 0 0' }}>{agents.length} agent(s) · {agents.filter(a => a.isActive).length} actif(s)</p>
        </div>
        <button onClick={exportCSV} style={{ padding: '8px 16px', background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: 8, color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          📥 Export CSV
        </button>
      </div>

      {topAgents.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          {topAgents.map((a, i) => (
            <div key={a.id} style={{ background: '#18181b', borderRadius: 12, padding: 16, border: `1px solid ${i === 0 ? '#eab30840' : '#27272a'}`, cursor: 'pointer' }} onClick={() => router.push(`/super-admin/agents/${a.id}`)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 20 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : '🥉'}</span>
                <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>{agentName(a)[0]}</div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{agentName(a)}</div>
                  <code style={{ fontSize: 10, color: '#a855f7', background: '#27272a', padding: '1px 4px', borderRadius: 3 }}>{a.code}</code>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16 }}>
                <div><div style={{ fontSize: 16, fontWeight: 700, color: '#a855f7' }}>{a._stats.total}</div><div style={{ fontSize: 10, color: '#71717a' }}>boutiques</div></div>
                <div><div style={{ fontSize: 16, fontWeight: 700, color: '#22c55e' }}>{a._stats.active}</div><div style={{ fontSize: 10, color: '#71717a' }}>actives</div></div>
                <div><div style={{ fontSize: 16, fontWeight: 700, color: '#3b82f6' }}>{a._activation}%</div><div style={{ fontSize: 10, color: '#71717a' }}>activation</div></div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {filters.map(s => (
          <button key={s.key} onClick={() => { setFilter(s.key); setPage(1); }} style={{
            padding: '10px 16px', borderRadius: 10, background: filter === s.key ? `${s.color}15` : '#18181b',
            border: `1px solid ${filter === s.key ? s.color : '#27272a'}`, cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: '#71717a' }}>{s.label}</div>
          </button>
        ))}
      </div>

      <div style={{ position: 'relative', marginBottom: 16 }}>
        <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher nom, telephone, code agent..." style={{
          width: '100%', padding: '9px 14px 9px 36px', background: '#18181b', border: '1px solid #27272a',
          borderRadius: 8, fontSize: 13, color: '#fff', outline: 'none',
        }} />
        <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
      </div>

      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #27272a' }}>
              {[{ l: 'Agent', k: 'name' }, { l: 'Code', k: 'code' }, { l: 'Telephone', k: 'phone' }, { l: 'Ville', k: 'city' }, { l: 'Boutiques', k: 'stores' }, { l: 'Activation', k: 'activation' }, { l: 'Creation', k: 'createdAt' }, { l: 'Statut', k: 'status' }].map(h => (
                <th key={h.l} onClick={() => { setSort(h.k); setDir(d => d === 'asc' ? 'desc' : 'asc'); setPage(1); }} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  {h.l} {sort === h.k ? (dir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr><td colSpan={8} style={{ textAlign: 'center', padding: 60, color: '#71717a', fontSize: 13 }}>Aucun agent trouve</td></tr>
            ) : paginated.map(a => (
              <tr key={a.id} style={{ borderBottom: '1px solid #27272a', cursor: 'pointer' }} onClick={() => router.push(`/super-admin/agents/${a.id}`)}>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 34, height: 34, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 600, color: '#fff' }}>{agentName(a)[0]}</div>
                    <div><div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{agentName(a)}</div></div>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#a855f7', fontFamily: 'monospace' }}>{a.code}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{a.phone || '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{a.city || '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>
                  <span style={{ background: '#a855f720', color: '#a855f7', padding: '2px 8px', borderRadius: 4, fontWeight: 600 }}>{a._stats.total}</span>
                  <span style={{ color: '#22c55e', fontSize: 10, marginLeft: 4 }}>{a._stats.active} active</span>
                </td>
                <td style={{ padding: '10px 14px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 60, height: 4, borderRadius: 2, background: '#27272a', overflow: 'hidden' }}>
                      <div style={{ width: `${a._activation}%`, height: '100%', borderRadius: 2, background: a._activation >= 70 ? '#22c55e' : a._activation >= 40 ? '#eab308' : '#ef4444' }} />
                    </div>
                    <span style={{ fontSize: 11, fontWeight: 600, color: a._activation >= 70 ? '#22c55e' : a._activation >= 40 ? '#eab308' : '#ef4444' }}>{a._activation}%</span>
                  </div>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>{a.createdAt ? new Date(a.createdAt).toLocaleDateString('fr-FR') : '-'}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: a.isActive ? '#22c55e20' : '#ef444420', color: a.isActive ? '#22c55e' : '#ef4444' }}>{a.isActive ? 'Actif' : 'Inactif'}</span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, padding: '0 4px' }}>
          <span style={{ fontSize: 12, color: '#71717a' }}>Page {page} / {totalPages} · {filtered.length} resultats</span>
          <div style={{ display: 'flex', gap: 4 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={{ padding: '6px 12px', background: '#18181b', border: '1px solid #27272a', borderRadius: 6, color: page === 1 ? '#52525b' : '#fff', cursor: page === 1 ? 'not-allowed' : 'pointer', fontSize: 12 }}>←</button>
            {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
              const start = Math.max(1, page - 2);
              const pg = start + i;
              return pg <= totalPages ? (
                <button key={pg} onClick={() => setPage(pg)} style={{ padding: '6px 10px', background: page === pg ? '#a855f7' : '#18181b', border: '1px solid #27272a', borderRadius: 6, color: '#fff', cursor: 'pointer', fontSize: 12, minWidth: 32 }}>{pg}</button>
              ) : null;
            })}
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={{ padding: '6px 12px', background: '#18181b', border: '1px solid #27272a', borderRadius: 6, color: page === totalPages ? '#52525b' : '#fff', cursor: page === totalPages ? 'not-allowed' : 'pointer', fontSize: 12 }}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
