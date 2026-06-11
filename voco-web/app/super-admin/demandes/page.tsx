'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL;

interface Demande {
  _id: string;
  storeId: string;
  userId: string;
  partnerId: string;
  partnerName: string;
  amount: number;
  objective: string;
  phone: string;
  address: string;
  comment: string;
  status: string;
  emailSent: boolean;
  consentGiven: boolean;
  consentDate: string;
  dashboardUrl: string;
  createdAt: string;
  storeInfo?: { shopId: string; storeName: string; city: string; phone: string } | null;
}

const STATUS_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: '#FACC1520', text: '#FACC15', label: 'En attente' },
  info_required: { bg: '#FF9F4320', text: '#FF9F43', label: 'Infos requises' },
  accepted: { bg: '#4ADE8020', text: '#4ADE80', label: 'Acceptée' },
  rejected: { bg: '#EF444420', text: '#EF4444', label: 'Refusée' },
  closed: { bg: '#66666620', text: '#666', label: 'Clôturée' },
};

export default function DemandesPage() {
  const [demandes, setDemandes] = useState<Demande[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<Demande | null>(null);
  const [updating, setUpdating] = useState(false);

  const getHeaders = useCallback((): Record<string, string> => {
    const t = localStorage.getItem('adminToken');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (filter !== 'all') params.set('status', filter);
      const res = await fetch(`${API}/funding/admin/demandes?${params}`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setDemandes(data.data || []);
        setTotalPages(data.pages || 1);
      }
    } catch (e) {
      console.error('Erreur chargement demandes:', e);
    }
    setLoading(false);
  }, [page, filter, getHeaders]);

  useEffect(() => { load(); }, [load]);

  const updateStatus = async (id: string, status: string) => {
    setUpdating(true);
    try {
      const res = await fetch(`${API}/funding/admin/demandes/${id}`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (res.ok) {
        setSelected(null);
        load();
      }
    } catch (e) {
      console.error('Erreur update:', e);
    }
    setUpdating(false);
  };

  const fmt = (n: number) => n?.toLocaleString('fr-FR') + ' FCFA';
  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Demandes de Financement</h2>
        <p style={{ fontSize: 13, color: '#71717a', margin: '4px 0 0' }}>Gère les demandes entrantes des commerçants</p>
      </div>

      {/* Filtres */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {['all', 'pending', 'info_required', 'accepted', 'rejected', 'closed'].map((s) => (
          <button key={s} onClick={() => { setFilter(s); setPage(1); }} style={{
            padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer', border: 'none',
            background: filter === s ? '#8A4DFF' : '#27272a',
            color: filter === s ? '#fff' : '#A8A3C2',
          }}>
            {s === 'all' ? 'Toutes' : STATUS_COLORS[s]?.label || s}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>Chargement...</div>
      ) : demandes.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#18181b', borderRadius: 12, border: '1px solid #27272a' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>📋</div>
          <div style={{ color: '#71717a', fontSize: 14 }}>Aucune demande</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {demandes.map((d) => {
            const st = STATUS_COLORS[d.status] || STATUS_COLORS.pending;
            return (
              <div key={d._id} onClick={() => setSelected(d)} style={{
                background: '#18181b', borderRadius: 12, border: '1px solid #27272a',
                padding: 20, cursor: 'pointer', transition: 'border-color 0.2s',
              }}
                onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#8A4DFF40')}
                onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#27272a')}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                      <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{fmt(d.amount)}</div>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                        background: st.bg, color: st.text,
                      }}>{st.label}</span>
                      {d.emailSent && (
                        <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#4ADE8020', color: '#4ADE80' }}>
                          Email envoyé
                        </span>
                      )}
                      {d.consentGiven && (
                        <span style={{ padding: '3px 8px', borderRadius: 20, fontSize: 10, fontWeight: 600, background: '#22D3EE20', color: '#22D3EE' }}>
                          Consentement ✓
                        </span>
                      )}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginTop: 8 }}>
                      <div>
                        <div style={{ fontSize: 10, color: '#52525b' }}>Commerçant</div>
                        <div style={{ fontSize: 13, color: '#d4d4d8' }}>{d.storeInfo?.storeName || d.storeId}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#52525b' }}>Partenaire</div>
                        <div style={{ fontSize: 13, color: '#d4d4d8' }}>{d.partnerName || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#52525b' }}>Objectif</div>
                        <div style={{ fontSize: 13, color: '#d4d4d8' }}>{d.objective || '—'}</div>
                      </div>
                      <div>
                        <div style={{ fontSize: 10, color: '#52525b' }}>Date</div>
                        <div style={{ fontSize: 13, color: '#d4d4d8' }}>{fmtDate(d.createdAt)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 20 }}>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#27272a', color: '#A8A3C2', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.4 : 1 }}>
            ← Préc
          </button>
          <span style={{ padding: '6px 12px', color: '#71717a', fontSize: 13 }}>{page}/{totalPages}</span>
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
            style={{ padding: '6px 12px', borderRadius: 8, border: 'none', background: '#27272a', color: '#A8A3C2', cursor: page >= totalPages ? 'default' : 'pointer', opacity: page >= totalPages ? 0.4 : 1 }}>
            Suiv →
          </button>
        </div>
      )}

      {/* MODAL DÉTAIL */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }} onClick={() => setSelected(null)}>
          <div style={{
            background: '#18181b', borderRadius: 16, padding: 24, maxWidth: 560, width: '100%',
            maxHeight: '85vh', overflow: 'auto', border: '1px solid #27272a',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>Détail de la demande</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: 12 }}>
              <DetailRow label="Montant" value={fmt(selected.amount)} />
              <DetailRow label="Statut" value={STATUS_COLORS[selected.status]?.label || selected.status} color={STATUS_COLORS[selected.status]?.text} />
              <DetailRow label="Commerçant" value={selected.storeInfo?.storeName || selected.storeId} />
              <DetailRow label="Ville" value={selected.storeInfo?.city || '—'} />
              <DetailRow label="Téléphone" value={selected.phone} />
              <DetailRow label="Partenaire" value={selected.partnerName || '—'} />
              <DetailRow label="Objectif" value={selected.objective || '—'} />
              <DetailRow label="Adresse" value={selected.address || '—'} />
              <DetailRow label="Commentaire" value={selected.comment || '—'} />
              <DetailRow label="Consentement" value={selected.consentGiven ? '✅ Oui' : '❌ Non'} />
              <DetailRow label="Email envoyé" value={selected.emailSent ? '✅ Oui' : '❌ Non'} />
              <DetailRow label="Date" value={fmtDate(selected.createdAt)} />
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8, marginTop: 20, flexWrap: 'wrap' }}>
              {selected.status === 'pending' && (
                <>
                  <button onClick={() => updateStatus(selected._id, 'accepted')} disabled={updating} style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none', background: '#4ADE80', color: '#000',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>Accepter</button>
                  <button onClick={() => updateStatus(selected._id, 'info_required')} disabled={updating} style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none', background: '#FF9F43', color: '#000',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>Demander infos</button>
                  <button onClick={() => updateStatus(selected._id, 'rejected')} disabled={updating} style={{
                    padding: '8px 16px', borderRadius: 8, border: 'none', background: '#EF4444', color: '#fff',
                    fontWeight: 700, fontSize: 13, cursor: 'pointer',
                  }}>Refuser</button>
                </>
              )}
              {selected.status !== 'closed' && selected.status !== 'rejected' && (
                <button onClick={() => updateStatus(selected._id, 'closed')} disabled={updating} style={{
                  padding: '8px 16px', borderRadius: 8, border: '1px solid #27272a', background: 'transparent',
                  color: '#71717a', fontWeight: 600, fontSize: 13, cursor: 'pointer',
                }}>Clôturer</button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #27272a' }}>
      <span style={{ color: '#71717a', fontSize: 13 }}>{label}</span>
      <span style={{ color: color || '#d4d4d8', fontSize: 13, fontWeight: 600, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
