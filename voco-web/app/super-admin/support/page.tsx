'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';
const fmt = (n: number) => n.toLocaleString('fr-FR');

const pColor = (p: string) => ({ high: '#ef4444', medium: '#eab308', low: '#3b82f6' })[p] || '#71717a';
const pLabel = (p: string) => ({ high: 'Haute', medium: 'Moyenne', low: 'Basse' })[p] || p;
const sColor = (s: string) => ({ open: '#22c55e', in_progress: '#eab308', resolved: '#3b82f6', closed: '#71717a' })[s] || '#71717a';
const sLabel = (s: string) => ({ open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' })[s] || s;

export default function SuperAdminSupport() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 50, total: 0 });
  const [breakdown, setBreakdown] = useState<any>({});
  const [statusFilter, setStatusFilter] = useState('');
  const [priorityFilter, setPriorityFilter] = useState('');

  // Detail modal
  const [detail, setDetail] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const fetchTickets = async () => {
    const t = localStorage.getItem('adminToken');
    if (!t) { router.push('/admin/login'); return; }
    try {
      const params = new URLSearchParams();
      if (statusFilter) params.set('status', statusFilter);
      if (priorityFilter) params.set('priority', priorityFilter);
      const r = await fetch(`${API}/admin/support?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        setTickets(d.tickets);
        setMeta(d.meta);
        setBreakdown(d.statusBreakdown);
      }
    } catch {} finally { setLoading(false); }
  };

  const seedTickets = async () => {
    const t = localStorage.getItem('adminToken');
    const r = await fetch(`${API}/admin/support/seed`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}` },
    });
    if (r.ok) fetchTickets();
  };

  useEffect(() => { fetchTickets(); }, [statusFilter, priorityFilter]);

  const handleStatusChange = async (id: string, status: string) => {
    const t = localStorage.getItem('adminToken');
    await fetch(`${API}/admin/support/${id}`, {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    });
    fetchTickets();
    if (detail?._id === id) setDetail({ ...detail, status });
  };

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;
    setSending(true);
    const t = localStorage.getItem('adminToken');
    const r = await fetch(`${API}/admin/support/${detail._id}/reply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: replyText }),
    });
    if (r.ok) {
      const d = await r.json();
      setDetail(d.ticket);
      setReplyText('');
      fetchTickets();
    }
    setSending(false);
  };

  const openCount = (breakdown.open || 0) + (breakdown.in_progress || 0);

  if (loading) return <div style={{ display: 'flex', justifyContent: 'center', height: '40vh', alignItems: 'center' }}><div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>;

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>🎧 Support</h2>
        {meta.total === 0 && (
          <button onClick={seedTickets} style={{ padding: '6px 14px', borderRadius: 8, background: '#a855f7', border: 'none', color: '#fff', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
            + Créer tickets démo
          </button>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>{fmt(openCount)} ticket(s) ouvert(s) · {fmt(meta.total)} total</p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))', gap: 10, marginBottom: 16 }}>
        {[
          { key: '', label: 'Tous', value: meta.total, color: '#a855f7' },
          { key: 'open', label: 'Ouverts', value: breakdown.open || 0, color: '#22c55e' },
          { key: 'in_progress', label: 'En cours', value: breakdown.in_progress || 0, color: '#eab308' },
          { key: 'resolved', label: 'Résolus', value: breakdown.resolved || 0, color: '#3b82f6' },
          { key: 'closed', label: 'Fermés', value: breakdown.closed || 0, color: '#71717a' },
        ].map(s => (
          <button key={s.key} onClick={() => setStatusFilter(s.key)} style={{
            padding: '10px', borderRadius: 8, textAlign: 'center',
            background: statusFilter === s.key ? `${s.color}15` : '#18181b',
            border: `1px solid ${statusFilter === s.key ? s.color : '#27272a'}`, cursor: 'pointer',
          }}>
            <div style={{ fontSize: 18, fontWeight: 700, color: s.color }}>{fmt(s.value)}</div>
            <div style={{ fontSize: 10, color: '#71717a', marginTop: 2 }}>{s.label}</div>
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'high', 'medium', 'low'].map(p => (
          <button key={p} onClick={() => setPriorityFilter(priorityFilter === p ? '' : p)} style={{
            padding: '5px 12px', borderRadius: 6, fontSize: 11, fontWeight: 500,
            background: priorityFilter === p ? `${pColor(p || 'low')}20` : '#27272a',
            border: `1px solid ${priorityFilter === p ? pColor(p || 'low') : '#27272a'}`,
            color: priorityFilter === p ? pColor(p || 'low') : '#71717a', cursor: 'pointer',
          }}>{p ? `🟢 ${pLabel(p)}` : 'Toutes priorités'}</button>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {tickets.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 60, color: '#71717a', fontSize: 13 }}>Aucun ticket</div>
        ) : tickets.map(t => (
          <button key={t._id} onClick={() => setDetail(t)} style={{
            display: 'flex', alignItems: 'center', gap: 16, background: '#18181b', borderRadius: 10, padding: '14px 20px',
            border: '1px solid #27272a', cursor: 'pointer', width: '100%', textAlign: 'left', flexWrap: 'wrap',
          }}>
            <div style={{ width: 36, height: 36, borderRadius: 8, background: `${sColor(t.status)}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16 }}>
              {t.status === 'resolved' || t.status === 'closed' ? '✅' : t.priority === 'high' ? '🔴' : '🟡'}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{t.subject}</div>
              <div style={{ fontSize: 12, color: '#71717a' }}>{t.storeName} · {new Date(t.createdAt).toLocaleDateString('fr-FR')}</div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: `${pColor(t.priority)}20`, color: pColor(t.priority) }}>{pLabel(t.priority)}</span>
              <span style={{ padding: '3px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: `${sColor(t.status)}20`, color: sColor(t.status) }}>{sLabel(t.status)}</span>
            </div>
          </button>
        ))}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#18181b', borderRadius: 16, width: '100%', maxWidth: 560, maxHeight: '90vh', display: 'flex', flexDirection: 'column', border: '1px solid #27272a', animation: 'scaleIn 0.2s ease-out' }} onClick={e => e.stopPropagation()}>
            {/* Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #27272a' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0, flex: 1 }}>{detail.subject}</h3>
                <button onClick={() => setDetail(null)} style={{ background: '#27272a', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 6, cursor: 'pointer', fontSize: 14, flexShrink: 0 }}>✕</button>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 12, color: '#71717a' }}>
                <span>🏪 {detail.storeName}</span>
                <span style={{ padding: '2px 8px', borderRadius: 10, background: `${pColor(detail.priority)}20`, color: pColor(detail.priority), fontSize: 10 }}>{pLabel(detail.priority)}</span>
                <span style={{ padding: '2px 8px', borderRadius: 10, background: `${sColor(detail.status)}20`, color: sColor(detail.status), fontSize: 10 }}>{sLabel(detail.status)}</span>
                <span>{new Date(detail.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
              </div>
            </div>

            {/* Messages */}
            <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 12, minHeight: 200 }}>
              {/* Original message */}
              <div style={{ alignSelf: 'flex-start', maxWidth: '85%', background: '#27272a', borderRadius: '12px 12px 12px 0', padding: '12px 16px' }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#a855f7', marginBottom: 4 }}>{detail.storeName}</div>
                <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.4 }}>{detail.message}</div>
              </div>

              {/* Replies */}
              {(detail.replies || []).map((r: any, i: number) => (
                <div key={i} style={{ alignSelf: r.isAdmin ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                  <div style={{ background: r.isAdmin ? '#a855f715' : '#27272a', borderRadius: r.isAdmin ? '12px 12px 0 12px' : '12px 12px 12px 0', padding: '12px 16px', border: r.isAdmin ? '1px solid #a855f720' : 'none' }}>
                    <div style={{ fontSize: 11, fontWeight: 600, color: r.isAdmin ? '#a855f7' : '#a1a1aa', marginBottom: 4 }}>{r.isAdmin ? 'Super Admin' : r.author}</div>
                    <div style={{ fontSize: 13, color: '#e4e4e7', lineHeight: 1.4 }}>{r.message}</div>
                  </div>
                  <div style={{ fontSize: 10, color: '#52525b', marginTop: 4, textAlign: r.isAdmin ? 'right' : 'left' }}>
                    {new Date(r.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>

            {/* Reply + Actions */}
            <div style={{ borderTop: '1px solid #27272a', padding: '16px 24px' }}>
              {(detail.status === 'open' || detail.status === 'in_progress') && (
                <form onSubmit={handleReply} style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                  <input value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Écrire une réponse..." style={{
                    flex: 1, padding: '10px 14px', borderRadius: 8, border: '1px solid #27272a', background: '#09090b',
                    color: '#fff', fontSize: 13, outline: 'none',
                  }} />
                  <button type="submit" disabled={sending || !replyText.trim()} style={{
                    padding: '10px 18px', borderRadius: 8, background: '#a855f7', border: 'none', color: '#fff',
                    fontSize: 13, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1,
                  }}>{sending ? '...' : 'Envoyer'}</button>
                </form>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {detail.status !== 'resolved' && (
                  <button onClick={() => handleStatusChange(detail._id, 'resolved')} style={{ padding: '6px 12px', borderRadius: 6, background: '#22c55e20', border: '1px solid #22c55e', color: '#22c55e', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                    ✅ Marquer résolu
                  </button>
                )}
                {detail.status !== 'in_progress' && detail.status === 'open' && (
                  <button onClick={() => handleStatusChange(detail._id, 'in_progress')} style={{ padding: '6px 12px', borderRadius: 6, background: '#eab30820', border: '1px solid #eab308', color: '#eab308', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                    📋 Prendre en charge
                  </button>
                )}
                {detail.status !== 'closed' && (
                  <button onClick={() => handleStatusChange(detail._id, 'closed')} style={{ padding: '6px 12px', borderRadius: 6, background: '#ef444420', border: '1px solid #ef4444', color: '#ef4444', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>
                    ✕ Fermer
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
