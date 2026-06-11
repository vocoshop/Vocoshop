'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

export default function NotificationsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, total: 0 });
  const [agents, setAgents] = useState<any[]>([]);
  const [showSend, setShowSend] = useState(false);
  const [sendTarget, setSendTarget] = useState('');
  const [sendTitle, setSendTitle] = useState('');
  const [sendMsg, setSendMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [bcTitle, setBcTitle] = useState('');
  const [bcMsg, setBcMsg] = useState('');
  const [bcSending, setBcSending] = useState(false);

  const token = typeof window !== 'undefined' ? localStorage.getItem('managerToken') : null;
  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchNotifs = async (p = 1) => {
    try {
      const r = await fetch(`${API}/admin-manager/agent-notifications?limit=50&page=${p}`, { headers });
      const d = await r.json();
      setNotifications(d.notifications || []);
      setMeta(d.meta || { page: 1, total: 0 });
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    if (!token) { router.push('/manager-login'); return; }
    fetchNotifs();
    fetch(`${API}/admin-manager/agents?limit=100`, { headers })
      .then(r => r.json()).then(d => setAgents(Array.isArray(d?.agents) ? d.agents : [])).catch(() => {});
  }, []);

  const handleSend = async () => {
    if (!sendTarget || !sendTitle.trim() || !sendMsg.trim()) return;
    setSending(true);
    try {
      await fetch(`${API}/admin-manager/agents/${sendTarget}/send-notification`, {
        method: 'POST', headers, body: JSON.stringify({ title: sendTitle.trim(), message: sendMsg.trim() }),
      });
      setSendTitle(''); setSendMsg(''); setSendTarget(''); setShowSend(false);
      fetchNotifs();
    } catch {} finally { setSending(false); }
  };

  const handleBroadcast = async () => {
    if (!bcTitle.trim() || !bcMsg.trim()) return;
    setBcSending(true);
    try {
      await fetch(`${API}/admin-manager/broadcast-message`, {
        method: 'POST', headers, body: JSON.stringify({ title: bcTitle.trim(), message: bcMsg.trim() }),
      });
      setBcTitle(''); setBcMsg(''); setShowBroadcast(false);
    } catch {} finally { setBcSending(false); }
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>
          Notifications <span style={{ fontSize: 13, color: '#71717a', fontWeight: 400 }}>({meta.total})</span>
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setShowSend(true); setShowBroadcast(false); }} style={{ padding: '8px 14px', borderRadius: 8, border: '1px solid #27272a', background: '#111113', color: '#fff', cursor: 'pointer', fontSize: 12 }}>
            ✉️ Envoyer à un agent
          </button>
          <button onClick={() => { setShowBroadcast(true); setShowSend(false); }} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: '#a855f7', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}>
            📢 Diffuser à tous
          </button>
        </div>
      </div>

      {/* Send modal */}
      {showSend && (
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 12px' }}>Envoyer une notification</h3>
          <select value={sendTarget} onChange={e => setSendTarget(e.target.value)} style={{ width: '100%', padding: '8px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 6, color: '#fff', fontSize: 13, marginBottom: 8, outline: 'none' }}>
            <option value="">Sélectionner un agent...</option>
            {agents.map((a: any) => <option key={a._id} value={a._id}>{a.name || a.code} ({a.code})</option>)}
          </select>
          <input value={sendTitle} onChange={e => setSendTitle(e.target.value)} placeholder="Titre" style={{ width: '100%', padding: '8px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 6, color: '#fff', fontSize: 13, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
          <textarea value={sendMsg} onChange={e => setSendMsg(e.target.value)} placeholder="Message..." rows={3} style={{ width: '100%', padding: '8px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 6, color: '#fff', fontSize: 13, marginBottom: 10, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowSend(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #27272a', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 12 }}>Annuler</button>
            <button onClick={handleSend} disabled={sending || !sendTarget || !sendTitle.trim() || !sendMsg.trim()} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: sending || !sendTarget || !sendTitle.trim() || !sendMsg.trim() ? '#27272a' : '#a855f7', color: sending || !sendTarget || !sendTitle.trim() || !sendMsg.trim() ? '#52525b' : '#fff', cursor: sending ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}>
              {sending ? 'Envoi...' : 'Envoyer'}
            </button>
          </div>
        </div>
      )}

      {/* Broadcast modal */}
      {showBroadcast && (
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 16, marginBottom: 20 }}>
          <h3 style={{ fontSize: 14, fontWeight: 600, color: '#fff', margin: '0 0 12px' }}>📢 Diffuser à tous les agents</h3>
          <p style={{ fontSize: 12, color: '#71717a', marginBottom: 10 }}>Cette notification sera envoyée à toutes les boutiques de vos agents.</p>
          <input value={bcTitle} onChange={e => setBcTitle(e.target.value)} placeholder="Titre" style={{ width: '100%', padding: '8px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 6, color: '#fff', fontSize: 13, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
          <textarea value={bcMsg} onChange={e => setBcMsg(e.target.value)} placeholder="Message..." rows={3} style={{ width: '100%', padding: '8px 10px', background: '#09090b', border: '1px solid #1a1a1e', borderRadius: 6, color: '#fff', fontSize: 13, marginBottom: 10, outline: 'none', resize: 'none', boxSizing: 'border-box' }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={() => setShowBroadcast(false)} style={{ padding: '8px 16px', borderRadius: 6, border: '1px solid #27272a', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 12 }}>Annuler</button>
            <button onClick={handleBroadcast} disabled={bcSending || !bcTitle.trim() || !bcMsg.trim()} style={{ padding: '8px 16px', borderRadius: 6, border: 'none', background: bcSending || !bcTitle.trim() || !bcMsg.trim() ? '#27272a' : '#a855f7', color: bcSending || !bcTitle.trim() || !bcMsg.trim() ? '#52525b' : '#fff', cursor: bcSending ? 'default' : 'pointer', fontSize: 12, fontWeight: 600 }}>
              {bcSending ? 'Envoi...' : 'Diffuser'}
            </button>
          </div>
        </div>
      )}

      {/* Notifications list */}
      {notifications.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 48, color: '#52525b', fontSize: 14 }}>Aucune notification</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {notifications.map((n: any) => (
            <div key={n._id} style={{ background: n.isRead ? '#111113' : '#1a0a2e', borderRadius: 10, border: `1px solid ${n.isRead ? '#1a1a1e' : '#3b1f6e'}`, padding: '12px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 2 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.4 }}>{n.message}</div>
                  <div style={{ fontSize: 10, color: '#52525b', marginTop: 4 }}>
                    {n.store?.storeName && <span>{n.store.storeName} · </span>}
                    {n.store?.agentCode && <span>Agent {n.store.agentCode} · </span>}
                    {n.createdAt && new Date(n.createdAt).toLocaleString('fr-FR')}
                  </div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, background: n.type === 'subscription' ? '#a855f720' : n.type === 'stock_low' ? '#ef444420' : '#3b82f620', color: n.type === 'subscription' ? '#a855f7' : n.type === 'stock_low' ? '#ef4444' : '#3b82f6', whiteSpace: 'nowrap' }}>{n.type}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
