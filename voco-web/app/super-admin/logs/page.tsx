'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const nColor: Record<string, string> = {
  error: '#ef4444', Erreur: '#ef4444',
  warning: '#eab308', Warning: '#eab308',
  security: '#dc2626', Critique: '#dc2626',
  webhook: '#3b82f6', Info: '#3b82f6',
  performance: '#eab308',
};

const nLabel: Record<string, string> = {
  error: 'Erreur', warning: 'Warning', security: 'Critique',
  webhook: 'Webhook', info: 'Info', performance: 'Lent',
};

const fmtDate = (iso: string) => {
  try { return new Date(iso).toLocaleString('fr-FR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }); }
  catch { return iso; }
};

export default function LogsPage() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0 });
  const [breakdown, setBreakdown] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState('7d');
  const [showFilters, setShowFilters] = useState(false);

  const fetchLogs = async (page = 1) => {
    const t = localStorage.getItem('adminToken');
    if (!t) return;
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', String(page));
      params.set('limit', '50');
      if (filter) params.set('level', filter);
      if (search) params.set('search', search);
      if (dateRange !== 'all') params.set('days', dateRange);
      const r = await fetch(`${API}/admin/logs?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      });
      if (r.ok) {
        const d = await r.json();
        setLogs(d.logs || []);
        setMeta(d.meta);
        setBreakdown(d.breakdown || {});
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchLogs(); }, [filter, dateRange]);

  const totalFiltered = Object.values(breakdown).reduce((s, v) => s + v, 0);

  const exportLogs = () => {
    const headers = ['Date', 'Niveau', 'Message', 'Source', 'IP', 'Code', 'Temps'];
    const rows = logs.map(l => [
      fmtDate(l.date), nLabel[l.type] || l.type || '', l.message || '', l.source || '', l.ip || '', l.statusCode || '', l.durationMs ? `${l.durationMs}ms` : '',
    ]);
    const csv = [[headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n')];
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `logs_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>📋 Logs système</h2>
          <p style={{ fontSize: 12, color: '#71717a', margin: '4px 0 0' }}>{meta.total} evenement(s) · TTL 30 jours</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowFilters(!showFilters)} style={{ padding: '8px 14px', background: '#18181b', border: '1px solid #27272a', borderRadius: 8, color: '#a1a1aa', cursor: 'pointer', fontSize: 12 }}>⚙️ Filtres</button>
          <button onClick={exportLogs} disabled={logs.length === 0} style={{ padding: '8px 14px', background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: 8, color: '#22c55e', cursor: logs.length === 0 ? 'not-allowed' : 'pointer', fontSize: 12, opacity: logs.length === 0 ? 0.5 : 1 }}>📥 Export</button>
        </div>
      </div>

      {showFilters && (
        <div style={{ background: '#18181b', borderRadius: 12, padding: 16, border: '1px solid #27272a', marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
          <div>
            <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 6 }}>Periode</label>
            <select value={dateRange} onChange={e => { setDateRange(e.target.value); setMeta(m => ({ ...m, page: 1 })); }} style={{ padding: '6px 12px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6, color: '#fff', fontSize: 12, outline: 'none' }}>
              <option value="1d">Aujourd'hui</option>
              <option value="7d">7 derniers jours</option>
              <option value="30d">30 derniers jours</option>
              <option value="90d">90 derniers jours</option>
              <option value="all">Tout</option>
            </select>
          </div>
          <div>
            <label style={{ fontSize: 11, color: '#71717a', display: 'block', marginBottom: 6 }}>Niveau</label>
            <select value={filter} onChange={e => { setFilter(e.target.value); setMeta(m => ({ ...m, page: 1 })); }} style={{ padding: '6px 12px', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6, color: '#fff', fontSize: 12, outline: 'none' }}>
              <option value="">Tous</option>
              <option value="error">Erreur</option>
              <option value="warning">Warning</option>
              <option value="security">Critique</option>
              <option value="webhook">Webhook</option>
              <option value="info">Info</option>
            </select>
          </div>
        </div>
      )}

      {Object.keys(breakdown).length > 0 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          <button onClick={() => { setFilter(''); setMeta(m => ({ ...m, page: 1 })); }} style={{ padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer', background: !filter ? '#a855f7' : '#27272a', border: 'none', color: '#fff' }}>
            Tous ({totalFiltered})
          </button>
          {Object.entries(breakdown).sort((a, b) => b[1] - a[1]).map(([lvl, count]) => (
            <button key={lvl} onClick={() => { setFilter(filter === lvl ? '' : lvl); setMeta(m => ({ ...m, page: 1 })); }} style={{
              padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500, cursor: 'pointer',
              background: filter === lvl ? `${nColor[lvl] || '#71717a'}` : '#27272a',
              border: `1px solid ${nColor[lvl] || '#71717a'}40`,
              color: filter === lvl ? '#fff' : (nColor[lvl] || '#71717a'),
            }}>
              {nLabel[lvl] || lvl} ({count})
            </button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <input value={search} onChange={e => setSearch(e.target.value)} onKeyDown={e => e.key === 'Enter' && fetchLogs()} placeholder="Rechercher dans les logs..." style={{
          flex: 1, minWidth: 200, padding: '9px 14px', background: '#18181b', border: '1px solid #27272a',
          borderRadius: 8, fontSize: 13, color: '#fff', outline: 'none',
        }} />
        <button onClick={() => fetchLogs()} style={{ padding: '9px 16px', background: '#a855f7', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 500 }}>Rechercher</button>
      </div>

      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead><tr style={{ borderBottom: '1px solid #27272a' }}>
            {['Date', 'Niveau', 'Message', 'Source', 'IP', 'Temps'].map(h => (
              <th key={h} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#a855f7' }}>Chargement...</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: 40, color: '#71717a', fontSize: 13 }}>Aucun log trouve</td></tr>
            ) : logs.map((l, i) => (
              <tr key={l.id || i} style={{ borderBottom: '1px solid #27272a' }}>
                <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b', whiteSpace: 'nowrap' }}>{fmtDate(l.date)}</td>
                <td style={{ padding: '10px 14px' }}>
                  <span style={{ padding: '3px 8px', borderRadius: 4, background: `${nColor[l.type] || '#71717a'}20`, color: nColor[l.type] || '#71717a', fontSize: 11, fontWeight: 500 }}>{nLabel[l.type] || l.type}</span>
                </td>
                <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa', maxWidth: 300 }}>
                  {l.path ? <span style={{ fontFamily: 'monospace', color: '#71717a', marginRight: 6 }}>{l.method} {l.path}</span> : null}
                  {l.message}
                  {l.statusCode && <span style={{ marginLeft: 6, color: l.statusCode >= 400 ? '#ef4444' : '#22c55e' }}>[{l.statusCode}]</span>}
                </td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>{l.source || '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b', fontFamily: 'monospace' }}>{l.ip || '-'}</td>
                <td style={{ padding: '10px 14px', fontSize: 11, color: (l.durationMs || 0) > 2000 ? '#eab308' : '#52525b' }}>
                  {l.durationMs ? `${l.durationMs}ms` : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {meta.total > meta.limit && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 16 }}>
          <span style={{ fontSize: 12, color: '#71717a' }}>Page {meta.page} / {Math.ceil(meta.total / meta.limit)} · {meta.total} resultats</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {meta.page > 1 && (
              <button onClick={() => fetchLogs(meta.page - 1)} style={{ padding: '7px 16px', borderRadius: 8, background: '#27272a', border: 'none', color: '#fff', fontSize: 12, cursor: 'pointer' }}>←</button>
            )}
            <button onClick={() => fetchLogs(meta.page + 1)} disabled={meta.page >= Math.ceil(meta.total / meta.limit)} style={{ padding: '7px 16px', borderRadius: 8, background: meta.page >= Math.ceil(meta.total / meta.limit) ? '#18181b' : '#a855f7', border: 'none', color: meta.page >= Math.ceil(meta.total / meta.limit) ? '#52525b' : '#fff', fontSize: 12, cursor: meta.page >= Math.ceil(meta.total / meta.limit) ? 'not-allowed' : 'pointer', opacity: meta.page >= Math.ceil(meta.total / meta.limit) ? 0.5 : 1 }}>→</button>
          </div>
        </div>
      )}
    </div>
  );
}
