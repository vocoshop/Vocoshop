'use client';

import { useState, useEffect, useCallback } from 'react';

const API = '/api';

interface Commission {
  _id: string;
  agentCode: string;
  storeId: string;
  storeName: string;
  amount: number;
  month: number;
  year: number;
  status: string;
  paidAt?: string;
  createdAt: string;
}

const STATUS_MAP: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FACC1520', text: '#FACC15', label: 'En attente' },
  paid: { bg: '#4ADE8020', text: '#4ADE80', label: 'Payée' },
  cancelled: { bg: '#EF444420', text: '#EF4444', label: 'Annulée' },
};

const MONTHS = ['Janvier','Février','Mars','Avril','Mai','Juin','Juillet','Août','Septembre','Octobre','Novembre','Décembre'];

export default function CommissionsPage() {
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [filter, setFilter] = useState('all');
  const [paying, setPaying] = useState<string | null>(null);

  const getHeaders = useCallback((): Record<string, string> => {
    const t = localStorage.getItem('adminToken') || localStorage.getItem('managerToken');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '50' });
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`${API}/admin-manager/commissions?${params}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setCommissions(data.commissions || []);
        setTotal(data.total || 0);
        setTotalAmount(data.totalAmount || 0);
        setPages(data.pages || 1);
      }
    } catch (e) {
      console.error('Erreur chargement commissions:', e);
    }
    setLoading(false);
  }, [page, filter, getHeaders]);

  useEffect(() => { load(); }, [load]);

  const markPaid = async (id: string) => {
    setPaying(id);
    try {
      const res = await fetch(`${API}/admin-manager/commissions/${id}/pay`, {
        method: 'PATCH',
        headers: getHeaders(),
      });
      if (res.ok) load();
    } catch (e) {
      console.error('Erreur paiement:', e);
    }
    setPaying(null);
  };

  const fmt = (n: number) => n.toLocaleString('fr-FR') + ' FCFA';

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Commissions Agents</h2>
        <p style={{ fontSize: 13, color: '#71717a', margin: '4px 0 0' }}>Suivi des commissions générées par les agents</p>
      </div>

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
        <StatCard label="Total commissions" value={fmt(totalAmount)} color="#8A4DFF" />
        <StatCard label="Nombre" value={String(total)} color="#22D3EE" />
        <StatCard label="En attente" value={fmt(commissions.filter(c => c.status === 'pending').reduce((s, c) => s + c.amount, 0))} color="#FACC15" />
        <StatCard label="Payées" value={fmt(commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0))} color="#4ADE80" />
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
        {['all', 'pending', 'paid', 'cancelled'].map((s) => (
          <button key={s} onClick={() => { setFilter(s); setPage(1); }} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: filter === s ? '#8A4DFF' : '#27272a',
            color: filter === s ? '#fff' : '#A8A3C2',
          }}>
            {s === 'all' ? 'Toutes' : STATUS_MAP[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>Chargement...</div>
      ) : commissions.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#18181b', borderRadius: 12, border: '1px solid #27272a' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>💰</div>
          <div style={{ color: '#71717a', fontSize: 14 }}>Aucune commission</div>
        </div>
      ) : (
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #27272a' }}>
                <th style={thStyle}>Agent</th>
                <th style={thStyle}>Boutique</th>
                <th style={thStyle}>Période</th>
                <th style={thStyle}>Montant</th>
                <th style={thStyle}>Statut</th>
                <th style={thStyle}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {commissions.map((c) => {
                const st = STATUS_MAP[c.status] || STATUS_MAP.pending;
                return (
                  <tr key={c._id} style={{ borderBottom: '1px solid #1e1e22' }}>
                    <td style={tdStyle}><span style={{ color: '#8A4DFF', fontWeight: 600 }}>{c.agentCode}</span></td>
                    <td style={tdStyle}>{c.storeName || '—'}</td>
                    <td style={tdStyle}>{MONTHS[c.month - 1]} {c.year}</td>
                    <td style={{ ...tdStyle, fontWeight: 700, color: '#fff' }}>{fmt(c.amount)}</td>
                    <td style={tdStyle}>
                      <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: st.bg, color: st.text }}>
                        {st.label}
                      </span>
                    </td>
                    <td style={tdStyle}>
                      {c.status === 'pending' && (
                        <button onClick={() => markPaid(c._id)} disabled={paying === c._id} style={{
                          padding: '4px 12px', borderRadius: 6, border: 'none', background: '#4ADE80', color: '#000',
                          fontWeight: 700, fontSize: 11, cursor: 'pointer',
                        }}>
                          {paying === c._id ? '...' : 'Marquer payée'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Pagination */}
      {pages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#27272a', color: '#A8A3C2', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>
            ← Préc
          </button>
          <span style={{ padding: '6px 12px', color: '#71717a', fontSize: 13 }}>{page}/{pages}</span>
          <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#27272a', color: '#A8A3C2', cursor: page >= pages ? 'default' : 'pointer', opacity: page >= pages ? 0.4 : 1 }}>
            Suiv →
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ background: '#18181b', borderRadius: 12, padding: 16, border: '1px solid #27272a' }}>
      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 800, color }}>{value}</div>
    </div>
  );
}

const thStyle: React.CSSProperties = { textAlign: 'left', padding: '10px 12px', color: '#71717a', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.05em' };
const tdStyle: React.CSSProperties = { padding: '10px 12px', color: '#d4d4d8' };
