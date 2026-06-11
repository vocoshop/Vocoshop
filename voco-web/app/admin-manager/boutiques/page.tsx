'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

const subColors: Record<string, string> = {
  actif: '#22c55e', actif_30j: '#22c55e', actif_7j: '#3b82f6',
  premium: '#a855f7', vip: '#f59e0b', gratuit: '#71717a', expiré: '#ef4444', desactivé: '#ef4444',
};

export default function BoutiquesPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [stores, setStores] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const limit = 20;

  const fetcher = (p: number, q: string) => {
    setLoading(true);
    const token = localStorage.getItem('managerToken');
    if (!token) { router.push('/manager-login'); return; }
    const h = { Authorization: `Bearer ${token}` };
    fetch(`${API}/admin-manager/stores?page=${p}&limit=${limit}&q=${encodeURIComponent(q)}`, { headers: h })
      .then(r => r.json()).then(d => {
        setStores(d.stores || []);
        setTotal(d.total || 0);
      }).catch(() => {}).finally(() => setLoading(false));
  };

  useEffect(() => {
    const token = localStorage.getItem('managerToken');
    if (!token) { router.push('/manager-login'); return; }
    fetcher(1, '');
  }, []);

  const handleSearch = (q: string) => {
    setQuery(q);
    setPage(1);
    fetcher(1, q);
  };

  const totalPages = Math.ceil(total / limit);

  const handleRowClick = (store: any) => {
    if (store.agentId) {
      router.push(`/admin-manager/agents/${store.agentId}`);
    }
  };

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      <p style={{ marginTop: 16, fontSize: 14 }}>Chargement des boutiques...</p>
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Boutiques</h1>
        <div style={{ position: 'relative', width: 280, maxWidth: '100%' }}>
          <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontSize: 14, color: '#52525b' }}>🔍</span>
          <input
            type="text" placeholder="Rechercher par boutique, téléphone, ville..."
            value={query} onChange={e => handleSearch(e.target.value)}
            style={{ width: '100%', padding: '10px 12px 10px 36px', borderRadius: 8, border: '1px solid #1a1a1e', background: '#111113', color: '#fff', fontSize: 13, outline: 'none' }}
          />
        </div>
      </div>

      {stores.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#52525b', fontSize: 14 }}>Aucune boutique trouvée</div>
      ) : (
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', overflow: 'hidden' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #1a1a1e' }}>
                  {['Boutique', 'Téléphone', 'Propriétaire', 'Ville', 'Abonnement', 'Agent', 'Dernière activité'].map(h => (
                    <th key={h} style={{ textAlign: 'left', padding: '12px 16px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase', whiteSpace: 'nowrap' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stores.map((s: any) => (
                  <tr key={s._id} onClick={() => handleRowClick(s)} style={{ borderBottom: '1px solid #1a1a1e', cursor: 'pointer', transition: 'background 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#1a1a1e'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                  >
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, color: '#fff', flexShrink: 0 }}>🏪</div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{s.storeName || s.name || '—'}</div>
                          <div style={{ fontSize: 11, color: '#52525b' }}>{s.shopId || s.code || ''}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#a1a1aa' }}>{s.phone || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#a1a1aa' }}>{(s.ownerName || s.owner || '—')}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#a1a1aa' }}>{s.city || '—'}</td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500,
                        background: `${subColors[s.subscription?.toLowerCase()] || '#71717a'}20`,
                        color: subColors[s.subscription?.toLowerCase()] || '#71717a',
                      }}>{s.subscription || s.status || '—'}</span>
                    </td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#a855f7' }}>{s.agentCode || s.codeAgent || '—'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 12, color: '#71717a' }}>{s.lastActivity ? new Date(s.lastActivity).toLocaleDateString('fr-FR') : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '14px 16px', borderTop: '1px solid #1a1a1e' }}>
              <button disabled={page <= 1} onClick={() => { setPage(p => p - 1); fetcher(page - 1, query); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #27272a', background: page <= 1 ? '#09090b' : '#1a1a1e', color: page <= 1 ? '#52525b' : '#fff', fontSize: 12, cursor: page <= 1 ? 'not-allowed' : 'pointer' }}>← Précédent</button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                let p: number;
                if (totalPages <= 7) { p = i + 1; }
                else if (page <= 4) { p = i + 1; }
                else if (page >= totalPages - 3) { p = totalPages - 6 + i; }
                else { p = page - 3 + i; }
                return (
                  <button key={p} onClick={() => { setPage(p); fetcher(p, query); }} style={{
                    width: 32, height: 32, borderRadius: 6, border: 'none', fontSize: 12, cursor: 'pointer',
                    background: p === page ? '#a855f7' : 'transparent', color: p === page ? '#fff' : '#71717a', fontWeight: p === page ? 600 : 400,
                  }}>{p}</button>
                );
              })}
              <button disabled={page >= totalPages} onClick={() => { setPage(p => p + 1); fetcher(page + 1, query); }} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid #27272a', background: page >= totalPages ? '#09090b' : '#1a1a1e', color: page >= totalPages ? '#52525b' : '#fff', fontSize: 12, cursor: page >= totalPages ? 'not-allowed' : 'pointer' }}>Suivant →</button>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
