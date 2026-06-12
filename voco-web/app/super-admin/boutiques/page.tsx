'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const sColor = (s?: string) => ({ active: '#22c55e', trial: '#eab308', grace: '#3b82f6', expired: '#ef4444', unused: '#71717a' })[s || ''] || '#71717a';
const sLabel = (s?: string) => ({ active: 'Actif', trial: 'Trial', grace: 'Grace', expired: 'Expiré', unused: 'Inactif' })[s || ''] || 'En attente';

export default function BoutiquesPage() {
  const router = useRouter();
  const [stores, setStores] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState('storeName');
  const [dir, setDir] = useState<'asc' | 'desc'>('asc');
  const [page, setPage] = useState(1);
  const [perPage] = useState(20);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkAction, setBulkAction] = useState('');
  const [bulkDays, setBulkDays] = useState(30);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type: string) => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) return router.push('/admin/login');
    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const r = await fetch(`${API}/admin/stores?limit=500`, { headers: h }).catch(() => ({ ok: false, json: () => ({ stores: [] }) }));
        const d = await (async () => { try { return await r.json(); } catch { return { stores: [] }; } })();
        if (r.ok) setStores(d.stores || []);
      } catch {} finally { setLoading(false); }
    })();
  }, []);

  const filtered = stores
    .filter(s => filter === 'all' || s.subscriptionStatus === filter || (filter === 'unused' && (!s.subscriptionStatus || s.subscriptionStatus === 'unused')))
    .filter(s => (s.storeName || '').toLowerCase().includes(search.toLowerCase()) || (s.phone || '').includes(search) || (s.agentCode || '').toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      const va = (a[sort] || '').toString().toLowerCase();
      const vb = (b[sort] || '').toString().toLowerCase();
      return dir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va);
    });

  const totalPages = Math.ceil(filtered.length / perPage);
  const paginated = filtered.slice((page - 1) * perPage, page * perPage);
  const allChecked = paginated.length > 0 && paginated.every(s => selected.includes(s.storeId));
  const toggleAll = () => allChecked ? setSelected(prev => prev.filter(id => !paginated.find(s => s.storeId === id))) : setSelected(prev => [...new Set([...prev, ...paginated.map(s => s.storeId)])]);

  const handleBulkAction = async () => {
    if (selected.length === 0) return;
    setBulkLoading(true);
    const t = localStorage.getItem('adminToken');
    if (!t) { setBulkLoading(false); return; }
    try {
      if (bulkAction === 'suspend') {
        const results = await Promise.allSettled(selected.map(id =>
          fetch(`${API}/admin/stores/${id}/suspend`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' } }).then(r => r.ok)
        ));
        const ok = results.filter(r => r.status === 'fulfilled' && r.value).length;
        showToast(`${ok}/${selected.length} suspendues`, ok > 0 ? 'success' : 'error');
      } else if (bulkAction === 'extend') {
        const results = await Promise.allSettled(selected.map(id =>
          fetch(`${API}/admin/stores/${id}/extend`, { method: 'POST', headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ days: bulkDays }) }).then(r => r.ok)
        ));
        const ok = results.filter(r => r.status === 'fulfilled' && r.value).length;
        showToast(`${ok}/${selected.length} extendues de +${bulkDays}j`, ok > 0 ? 'success' : 'error');
      }
      setSelected([]);
      setShowBulkModal(false);
    } catch { showToast('Erreur', 'error'); }
    setBulkLoading(false);
  };

  const exportCSV = () => {
    const headers = ['Nom', 'Shop ID', 'Telephone', 'Ville', 'Statut', 'Plan', 'Agent', 'Cree le', 'Expire le'];
    const rows = filtered.map(s => [
      s.storeName, s.storeId?.slice(-12) || '', s.phone || '', s.city || '',
      sLabel(s.subscriptionStatus), s.plan || '', s.agentCode || '',
      s.installedAt ? new Date(s.installedAt).toLocaleDateString('fr-FR') : '',
      s.paidUntil ? new Date(s.paidUntil).toLocaleDateString('fr-FR') : '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `boutiques_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Export CSV downloaded', 'success');
  };

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh', color: '#71717a' }}><div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;

  const statuses = [
    { key: 'all', label: 'Toutes', count: stores.length, color: '#a855f7' },
    { key: 'active', label: 'Actives', count: stores.filter(s => s.subscriptionStatus === 'active').length, color: '#22c55e' },
    { key: 'trial', label: 'Trial', count: stores.filter(s => s.subscriptionStatus === 'trial').length, color: '#eab308' },
    { key: 'grace', label: 'Grace', count: stores.filter(s => s.subscriptionStatus === 'grace').length, color: '#3b82f6' },
    { key: 'expired', label: 'Expirees', count: stores.filter(s => s.subscriptionStatus === 'expired').length, color: '#ef4444' },
  ];

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, background: toast.type === 'success' ? '#22c55e20' : '#ef444420', border: `1px solid ${toast.type === 'success' ? '#22c55e' : '#ef4444'}`, color: toast.type === 'success' ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 500, backdropFilter: 'blur(8px)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>🏪 Boutiques</h2>
          <p style={{ fontSize: 12, color: '#71717a', margin: '4px 0 0' }}>{filtered.length} boutique(s) · {stores.filter(s => s.subscriptionStatus === 'active').length} active(s)</p>
        </div>
        <button onClick={exportCSV} style={{ padding: '8px 16px', background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: 8, color: '#22c55e', cursor: 'pointer', fontSize: 12, fontWeight: 500, display: 'flex', alignItems: 'center', gap: 6 }}>
          📥 Export CSV
        </button>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
        {statuses.map(s => (
          <button key={s.key} onClick={() => { setFilter(s.key); setPage(1); }} style={{
            padding: '10px 16px', borderRadius: 10, background: filter === s.key ? `${s.color}15` : '#18181b',
            border: `1px solid ${filter === s.key ? s.color : '#27272a'}`, cursor: 'pointer', textAlign: 'left',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{s.count}</div>
            <div style={{ fontSize: 11, color: '#71717a' }}>{s.label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ flex: 1, minWidth: 200, position: 'relative' }}>
          <input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Rechercher boutique, telephone, agent..." style={{
            width: '100%', padding: '9px 14px 9px 36px', background: '#18181b', border: '1px solid #27272a',
            borderRadius: 8, fontSize: 13, color: '#fff', outline: 'none',
          }} />
          <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
        </div>
        {selected.length > 0 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ fontSize: 12, color: '#a855f7', fontWeight: 500 }}>{selected.length} selectionne(s)</span>
            <button onClick={() => { setBulkAction('extend'); setShowBulkModal(true); }} style={{ padding: '8px 14px', background: '#22c55e20', border: '1px solid #22c55e40', borderRadius: 8, color: '#22c55e', cursor: 'pointer', fontSize: 12 }}>+Jours</button>
            <button onClick={() => { setBulkAction('suspend'); setShowBulkModal(true); }} style={{ padding: '8px 14px', background: '#eab30820', border: '1px solid #eab30840', borderRadius: 8, color: '#eab308', cursor: 'pointer', fontSize: 12 }}>Suspendre</button>
            <button onClick={() => setSelected([])} style={{ padding: '8px 14px', background: '#27272a', border: 'none', borderRadius: 8, color: '#71717a', cursor: 'pointer', fontSize: 12 }}>Annuler</button>
          </div>
        )}
      </div>

      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 800 }}>
          <thead>
            <tr style={{ borderBottom: '1px solid #27272a' }}>
              <th style={{ padding: '12px 14px', width: 40 }}><input type="checkbox" checked={allChecked} onChange={toggleAll} style={{ accentColor: '#a855f7' }} /></th>
              {[{ l: 'Boutique', k: 'storeName' }, { l: 'Shop ID', k: 'storeId' }, { l: 'Telephone', k: 'phone' }, { l: 'Ville', k: 'city' }, { l: 'Statut', k: 'subscriptionStatus' }, { l: 'Plan', k: 'plan' }, { l: 'Creation', k: 'installedAt' }, { l: 'Agent', k: 'agentCode' }].map(h => (
                <th key={h.l} onClick={() => { setSort(h.k); setDir(d => d === 'asc' ? 'desc' : 'asc'); setPage(1); }} style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                  {h.l} {sort === h.k ? (dir === 'asc' ? '↑' : '↓') : ''}
                </th>
              ))}
              <th style={{ textAlign: 'left', padding: '12px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.map(s => {
              const id = s.storeId;
              const checked = selected.includes(id);
              return (
                <tr key={id} style={{ borderBottom: '1px solid #27272a', background: checked ? '#a855f708' : 'transparent' }}>
                  <td style={{ padding: '12px 14px' }}><input type="checkbox" checked={checked} onChange={() => setSelected(prev => checked ? prev.filter(x => x !== id) : [...prev, id])} style={{ accentColor: '#a855f7' }} /></td>
                  <td style={{ padding: '12px 14px' }}><span onClick={() => router.push(`/super-admin/boutiques/${id}`)} style={{ color: '#fff', fontWeight: 500, fontSize: 13, cursor: 'pointer' }}>{s.storeName}</span></td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#a855f7' }}>{id?.slice(-8) || '-'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#a1a1aa' }}>{s.phone}</td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#a1a1aa' }}>{s.city || '-'}</td>
                  <td style={{ padding: '12px 14px' }}><span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${sColor(s.subscriptionStatus)}20`, color: sColor(s.subscriptionStatus) }}>{sLabel(s.subscriptionStatus)}</span></td>
                  <td style={{ padding: '12px 14px', fontSize: 12, color: '#a1a1aa' }}>{s.plan || (s.subscriptionStatus === 'active' ? 'Mensuel' : s.subscriptionStatus === 'trial' ? 'Essai 7j' : '-')}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: '#52525b' }}>{s.installedAt ? new Date(s.installedAt).toLocaleDateString('fr-FR') : s.createdAt ? new Date(s.createdAt).toLocaleDateString('fr-FR') : '-'}</td>
                  <td style={{ padding: '12px 14px', fontSize: 11, color: '#a855f7' }}>{s.agentCode || '-'}</td>
                  <td style={{ padding: '12px 14px' }}>
                    <button onClick={() => router.push(`/super-admin/boutiques/${id}`)} style={{ padding: '4px 8px', background: '#a855f710', border: 'none', borderRadius: 6, color: '#a855f7', cursor: 'pointer', fontSize: 11 }}>Voir</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && <div style={{ textAlign: 'center', padding: '60px 20px', color: '#71717a', fontSize: 13 }}>Aucune boutique trouvee</div>}
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

      {showBulkModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setShowBulkModal(false)}>
          <div style={{ background: '#18181b', borderRadius: 16, width: '100%', maxWidth: 400, padding: 24, border: '1px solid #27272a' }} onClick={e => e.stopPropagation()}>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{bulkAction === 'suspend' ? 'Suspendre' : 'Ajouter des jours'}</h3>
            <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>{selected.length} boutique(s) selectionnee(s)</p>
            {bulkAction === 'extend' && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                {[7, 15, 30, 90].map(d => (
                  <button key={d} onClick={() => setBulkDays(d)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: bulkDays === d ? '#a855f7' : '#27272a', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>+{d}j</button>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowBulkModal(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#27272a', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
              <button onClick={handleBulkAction} disabled={bulkLoading} style={{ flex: 1, padding: '10px', borderRadius: 8, background: bulkAction === 'suspend' ? '#eab308' : '#22c55e', border: 'none', color: '#fff', cursor: bulkLoading ? 'not-allowed' : 'pointer', opacity: bulkLoading ? 0.6 : 1, fontSize: 13, fontWeight: 600 }}>
                {bulkLoading ? '...' : bulkAction === 'suspend' ? `Suspendre (${selected.length})` : `+${bulkDays}j (${selected.length})`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
