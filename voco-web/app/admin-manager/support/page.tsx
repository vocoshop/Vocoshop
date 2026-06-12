'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const priorityColors: Record<string, string> = { low: '#22c55e', medium: '#eab308', high: '#ef4444' };
const priorityLabels: Record<string, string> = { low: 'Faible', medium: 'Moyenne', high: 'Haute' };
const statusColors: Record<string, string> = { open: '#22c55e', in_progress: '#eab308', resolved: '#3b82f6', closed: '#71717a' };
const statusLabels: Record<string, string> = { open: 'Ouvert', in_progress: 'En cours', resolved: 'Résolu', closed: 'Fermé' };
const statuses = ['open', 'in_progress', 'resolved', 'closed'];

export default function SupportPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<any[]>([]);
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<any>(null);
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('managerToken') || '' : '';
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };
  const managerName = typeof window !== 'undefined' ? localStorage.getItem('adminName') || 'Admin Manager' : 'Admin Manager';

  const fetchTickets = async () => {
    const url = `${API}/manager/support?limit=50${filterStatus ? `&status=${filterStatus}` : ''}`;
    try {
      const r = await fetch(url, { headers });
      const d = await r.json();
      setTickets(Array.isArray(d?.tickets) ? d.tickets : Array.isArray(d) ? d : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!token) { router.push('/manager-login'); return; }
    fetchTickets();
  }, [filterStatus]);

  const handleStatusChange = async (id: string, status: string) => {
    await fetch(`${API}/manager/support/${id}`, {
      method: 'PATCH', headers, body: JSON.stringify({ status }),
    });
    if (selected?._id === id) setSelected({ ...selected, status });
    fetchTickets();
  };

  const handleReply = async () => {
    if (!replyText.trim() || !selected) return;
    setSending(true);
    try {
      const r = await fetch(`${API}/manager/support/${selected._id}/reply`, {
        method: 'POST', headers, body: JSON.stringify({ message: replyText.trim(), author: managerName }),
      });
      const d = await r.json();
      if (d.ticket) setSelected(d.ticket);
      setReplyText('');
      fetchTickets();
    } catch (e) {
      console.error(e);
    } finally {
      setSending(false);
    }
  };

  const countByStatus = (s: string) => tickets.filter(t => t.status === s).length;

  const badge = (val: string, color: string) => (
    <span style={{ padding: '2px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: `${color}20`, color }}>
      {val}
    </span>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Support</h1>
        <div style={{ display: 'flex', gap: 6 }}>
          {['', 'open', 'in_progress', 'resolved', 'closed'].map(s => (
            <button key={s} onClick={() => setFilterStatus(s)} style={{
              padding: '5px 12px', borderRadius: 8, border: '1px solid', fontSize: 12, fontWeight: 500, cursor: 'pointer',
              background: filterStatus === s ? '#a855f7' : 'transparent',
              borderColor: filterStatus === s ? '#a855f7' : '#27272a',
              color: filterStatus === s ? '#fff' : '#71717a',
              transition: 'all 0.15s',
            }}>
              {s ? `${statusLabels[s]} (${countByStatus(s)})` : `Tous (${tickets.length})`}
            </button>
          ))}
        </div>
      </div>

      {tickets.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#52525b', fontSize: 14 }}>Aucun ticket de support</div>
      ) : (
        <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tickets.map((t: any) => (
              <div key={t._id} onClick={() => setSelected(t)} style={{
                background: selected?._id === t._id ? '#1a1a1e' : '#111113',
                borderRadius: 10, border: selected?._id === t._id ? '1px solid #a855f740' : '1px solid #1a1a1e',
                padding: '12px 16px', cursor: 'pointer', transition: 'all 0.12s',
              }}
                onMouseEnter={e => { if (selected?._id !== t._id) (e.currentTarget as HTMLElement).style.background = '#1a1a1e'; }}
                onMouseLeave={e => { if (selected?._id !== t._id) (e.currentTarget as HTMLElement).style.background = '#111113'; }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{t.subject || 'Sans titre'}</div>
                    <div style={{ fontSize: 11, color: '#52525b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {t.storeName && `${t.storeName} · `}{new Date(t.createdAt).toLocaleDateString('fr-FR')}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                    {badge(priorityLabels[t.priority] || t.priority, priorityColors[t.priority] || '#71717a')}
                    {badge(statusLabels[t.status] || t.status, statusColors[t.status] || '#71717a')}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {selected && (
            <div style={{ width: 380, flexShrink: 0, background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 16, maxHeight: '75vh', display: 'flex', flexDirection: 'column' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{selected.subject}</div>
              <div style={{ fontSize: 12, color: '#52525b', marginBottom: 10 }}>
                {selected.storeName && <span>{selected.storeName} · </span>}
                {new Date(selected.createdAt).toLocaleDateString('fr-FR')}
              </div>

              <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
                <select value={selected.status} onChange={e => handleStatusChange(selected._id, e.target.value)} style={{
                  padding: '4px 8px', borderRadius: 6, border: '1px solid #27272a', background: '#09090b', color: '#fff', fontSize: 12, outline: 'none', cursor: 'pointer',
                }}>
                  {statuses.map(s => <option key={s} value={s}>{statusLabels[s]}</option>)}
                </select>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ padding: '10px 12px', background: '#09090b', borderRadius: 8, border: '1px solid #1a1a1e' }}>
                  <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Message initial</div>
                  <div style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.5 }}>{selected.message}</div>
                </div>
                {(selected.replies || []).map((r: any, i: number) => (
                  <div key={i} style={{
                    padding: '10px 12px', borderRadius: 8, alignSelf: r.isAdmin ? 'flex-end' : 'flex-start',
                    background: r.isAdmin ? '#a855f710' : '#09090b',
                    border: `1px solid ${r.isAdmin ? '#a855f720' : '#1a1a1e'}`,
                    maxWidth: '100%',
                  }}>
                    <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>
                      {r.isAdmin ? '👤 ' : ''}{r.author} · {new Date(r.createdAt).toLocaleString('fr-FR')}
                    </div>
                    <div style={{ fontSize: 13, color: '#d4d4d8', lineHeight: 1.5 }}>{r.message}</div>
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <textarea value={replyText} onChange={e => setReplyText(e.target.value)} placeholder="Votre réponse..." rows={2} style={{
                  flex: 1, padding: '8px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 8,
                  color: '#fff', fontSize: 13, outline: 'none', resize: 'none',
                }} />
                <button onClick={handleReply} disabled={sending || !replyText.trim()} style={{
                  padding: '8px 16px', borderRadius: 8, border: 'none', cursor: sending || !replyText.trim() ? 'default' : 'pointer',
                  background: sending || !replyText.trim() ? '#27272a' : '#a855f7',
                  color: sending || !replyText.trim() ? '#52525b' : '#fff', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap',
                }}>
                  {sending ? '...' : 'Envoyer'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
