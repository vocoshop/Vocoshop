'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const TYPE_STYLES: Record<string, { label: string; color: string; bg: string }> = {
  blockchain: { label: 'On-chain', color: '#22c55e', bg: '#22c55e20' },
  database: { label: 'Base de données', color: '#a78bfa', bg: '#a78bfa20' },
};

export default function PreuvesPage() {
  const [proofs, setProofs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProofs = async () => {
    const token = localStorage.getItem('adminToken');
    if (!token) return;
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${token}` };
      const r = await fetch(`${API}/admin/blockchain/proofs?limit=100`, { headers: h });
      if (r.ok) {
        const d = await r.json();
        setProofs(d.proofs || []);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchProofs(); }, []);

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>
            🔗 Preuves Blockchain
          </h2>
          <p style={{ fontSize: 12, color: '#71717a', margin: 0 }}>
            Registre des ancrages de bilans — {proofs.length} preuves
          </p>
        </div>
        <button onClick={fetchProofs} style={{
          background: '#27272a', border: '1px solid #3f3f46', color: '#a1a1aa',
          padding: '6px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
        }}>
          Actualiser
        </button>
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 60, color: '#71717a' }}>
          Chargement des preuves...
        </div>
      ) : proofs.length === 0 ? (
        <div style={{
          background: '#18181b', border: '1px solid #27272a', borderRadius: 14,
          padding: 40, textAlign: 'center', color: '#71717a', fontSize: 13,
        }}>
          Aucune preuve blockchain pour le moment.
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#a1a1aa', fontWeight: 500 }}>Date</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#a1a1aa', fontWeight: 500 }}>Type</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#a1a1aa', fontWeight: 500 }}>Hash chaîne</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#a1a1aa', fontWeight: 500 }}>Boutique</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#a1a1aa', fontWeight: 500 }}>Mois</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#a1a1aa', fontWeight: 500 }}>Hash précédent</th>
                <th style={{ padding: '10px 12px', textAlign: 'left', color: '#a1a1aa', fontWeight: 500 }}>Explorateur</th>
              </tr>
            </thead>
            <tbody>
              {proofs.map((p: any, i: number) => {
                const ts = TYPE_STYLES[p.anchorType] || TYPE_STYLES.database;
                const date = p.createdAt ? new Date(p.createdAt).toLocaleDateString('fr-FR', {
                  day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
                }) : '—';
                return (
                  <tr key={p._id || i} style={{ borderBottom: '1px solid #27272a' }}>
                    <td style={{ padding: '10px 12px', color: '#d4d4d8' }}>{date}</td>
                    <td style={{ padding: '10px 12px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        fontSize: 11, fontWeight: 500, background: ts.bg, color: ts.color,
                      }}>
                        {ts.label}
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10, color: '#a1a1aa', maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {p.dataHash?.slice(0, 20)}...
                    </td>
                    <td style={{ padding: '10px 12px', color: '#d4d4d8' }}>{p.storeId?.slice(0, 12)}...</td>
                    <td style={{ padding: '10px 12px', color: '#d4d4d8' }}>{p.month || '—'}</td>
                    <td style={{ padding: '10px 12px', fontFamily: 'monospace', fontSize: 10, color: p.previousHash ? '#a1a1aa' : '#52525b', maxWidth: 120 }}>
                      {p.previousHash ? `${p.previousHash.slice(0, 12)}...` : 'genesis'}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      {p.explorerUrl ? (
                        <a href={p.explorerUrl} target="_blank" rel="noopener" style={{ color: '#a78bfa', textDecoration: 'none', fontSize: 11 }}>
                          Voir →
                        </a>
                      ) : (
                        <span style={{ color: '#52525b', fontSize: 11 }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
