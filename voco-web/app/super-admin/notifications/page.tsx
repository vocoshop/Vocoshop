'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const s = (n: number) => n.toLocaleString('fr-FR');

const TEMPLATES = [
  { title: 'Rappel abonnement', message: 'Votre abonnement VocoShop arrive bientôt à expiration. Pensez à le renouveler pour continuer à profiter de vos fonctionnalités.' },
  { title: 'Maintenance', message: 'Une maintenance technique est prévue cette nuit. La plateforme sera indisponible de 2h à 4h.' },
  { title: 'Nouvelle fonctionnalité', message: 'Découvrez les nouvelles fonctionnalités disponibles sur VocoShop : gestion des stocks améliorée et rapports détaillés.' },
  { title: 'Promotion', message: 'Profitez de notre offre spéciale : -50% sur l\'abonnement Premium pour toute nouvelle inscription ce mois-ci !' },
];

export default function SuperAdminNotifications() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  // Compose
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('push');
  const [targetType, setTargetType] = useState('all_agents');
  const [targetId, setTargetId] = useState('');
  const [targetCity, setTargetCity] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // History
  const [notifications, setNotifications] = useState<any[]>([]);
  const [meta, setMeta] = useState({ page: 1, limit: 20, total: 0 });
  const [statusFilter, setStatusFilter] = useState('');

  // Detail modal
  const [detail, setDetail] = useState<any>(null);

  const fetchNotifications = async (page = 1) => {
    const t = localStorage.getItem('adminToken');
    if (!t) return router.push('/admin/login');
    try {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (statusFilter) params.set('status', statusFilter);
      const r = await fetch(`${API}/admin/notifications?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        setNotifications(d.notifications);
        setMeta(d.meta);
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) { router.push('/admin/login'); return; }
    fetchNotifications();
  }, [statusFilter]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSending(true);
    const t = localStorage.getItem('adminToken');
    try {
      const body: any = { title, message, type, targetType };
      if (targetType === 'specific_agent' || targetType === 'specific_store') body.targetId = targetId;
      if (targetType === 'by_city') body.targetCity = targetCity;
      if (scheduledAt) body.scheduledAt = scheduledAt;

      const r = await fetch(`${API}/admin/notifications`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || 'Erreur'); setSending(false); return; }

      setSuccess(`Notification "${title}" envoyée à ${s(d.notification.stats.total)} destinataire(s)`);
      setTitle(''); setMessage(''); setTargetId(''); setTargetCity(''); setScheduledAt('');
      fetchNotifications(1);
    } catch { setError('Erreur de connexion'); } finally { setSending(false); }
  };

  const applyTemplate = (tpl: typeof TEMPLATES[0]) => {
    setTitle(tpl.title);
    setMessage(tpl.message);
  };

  const targetLabel = (nt: string) => ({
    all_agents: 'Tous les agents', all_stores: 'Toutes les boutiques',
    specific_agent: 'Agent spécifique', specific_store: 'Boutique spécifique',
    by_city: 'Par ville',
  })[nt] || nt;

  const statusColor = (st: string) => ({ sent: '#22c55e', scheduled: '#3b82f6', failed: '#ef4444' })[st] || '#71717a';

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 'calc(100vh - 120px)' }}>
      {/* LEFT — Compose */}
      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', padding: 24, display: 'flex', flexDirection: 'column' }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>📨 Nouvelle notification</h2>
        <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>Composez un message et choisissez la cible</p>

        <form onSubmit={handleSend} style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>
          {/* Target type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Cible</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
              {(['all_agents', 'all_stores', 'specific_agent', 'specific_store', 'by_city'] as const).map(t => (
                <button key={t} type="button" onClick={() => setTargetType(t)} style={{
                  padding: '8px 10px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                  background: targetType === t ? '#a855f720' : '#27272a',
                  border: `1px solid ${targetType === t ? '#a855f7' : '#27272a'}`, color: targetType === t ? '#a855f7' : '#71717a', cursor: 'pointer',
                }}>{targetLabel(t)}</button>
              ))}
            </div>
          </div>

          {/* Target ID / City */}
          {(targetType === 'specific_agent' || targetType === 'specific_store') && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>
                {targetType === 'specific_agent' ? "Code agent (ex: AG-1001-O)" : "ID Boutique"}
              </label>
              <input value={targetId} onChange={e => setTargetId(e.target.value)} placeholder={targetType === 'specific_agent' ? 'AG-1001-O' : 'storeId...'} style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#09090b',
                color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none',
              }} />
            </div>
          )}
          {targetType === 'by_city' && (
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Ville</label>
              <input value={targetCity} onChange={e => setTargetCity(e.target.value)} placeholder="Douala, Brazzaville..." style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#09090b',
                color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none',
              }} />
            </div>
          )}

          {/* Type */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Canal</label>
            <div style={{ display: 'flex', gap: 6 }}>
              {['push', 'sms', 'email'].map(t => (
                <button key={t} type="button" onClick={() => setType(t)} style={{
                  flex: 1, padding: '8px', borderRadius: 8, fontSize: 11, fontWeight: 500,
                  background: type === t ? '#a855f720' : '#27272a',
                  border: `1px solid ${type === t ? '#a855f7' : '#27272a'}`,
                  color: type === t ? '#a855f7' : '#71717a', cursor: 'pointer', textTransform: 'uppercase',
                }}>{t === 'push' ? '🔔 Push' : t === 'sms' ? '📱 SMS' : '📧 Email'}</button>
              ))}
            </div>
            {type !== 'push' && (
              <p style={{ fontSize: 11, color: '#eab308', marginTop: 6 }}>
                ⚠️ {type === 'sms' ? 'L\'envoi SMS est payant (coût par message)' : 'L\'envoi Email sera implémenté prochainement'}
              </p>
            )}
          </div>

          {/* Title */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Titre</label>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Titre de la notification" required style={{
              padding: '10px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#09090b',
              color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none',
            }} />
          </div>

          {/* Message */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Message</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Contenu du message..." required style={{
              flex: 1, minHeight: 100, padding: '10px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#09090b',
              color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none', resize: 'vertical', fontFamily: 'inherit',
            }} />
          </div>

          {/* Schedule */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Planification (optionnel)</label>
            <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} style={{
              padding: '10px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#09090b',
              color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none',
            }} />
          </div>

          {/* Quick templates */}
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Modèles rapides</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {TEMPLATES.map((t, i) => (
                <button key={i} type="button" onClick={() => applyTemplate(t)} style={{
                  padding: '5px 10px', borderRadius: 6, fontSize: 11, background: '#27272a',
                  border: '1px solid #27272a', color: '#a1a1aa', cursor: 'pointer',
                }}>{t.title}</button>
              ))}
            </div>
          </div>

          {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ef444415', color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>}
          {success && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#22c55e15', color: '#22c55e', fontSize: 13, textAlign: 'center' }}>{success}</div>}

          <button type="submit" disabled={sending} style={{
            padding: '12px 20px', borderRadius: 10, background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            border: 'none', color: '#fff', fontSize: 14, fontWeight: 600, cursor: sending ? 'not-allowed' : 'pointer',
            opacity: sending ? 0.6 : 1,
          }}>
            {sending ? 'Envoi en cours...' : scheduledAt ? '📅 Planifier' : '🚀 Envoyer'}
          </button>
        </form>
      </div>

      {/* RIGHT — History */}
      <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', padding: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>📋 Historique</h2>
            <p style={{ fontSize: 12, color: '#71717a', margin: '2px 0 0' }}>{s(meta.total)} notification(s) envoyée(s)</p>
          </div>
          <div style={{ display: 'flex', gap: 4, background: '#27272a', borderRadius: 8, padding: 3 }}>
            {[{ k: '', l: 'Tout' }, { k: 'sent', l: 'Envoyé' }, { k: 'scheduled', l: 'Planifié' }].map(f => (
              <button key={f.k} onClick={() => setStatusFilter(f.k)} style={{
                padding: '5px 10px', borderRadius: 6, fontSize: 11, fontWeight: 500,
                background: statusFilter === f.k ? '#a855f7' : 'transparent',
                border: 'none', color: statusFilter === f.k ? '#fff' : '#71717a', cursor: 'pointer',
              }}>{f.l}</button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
          {loading ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div style={{ width: 24, height: 24, border: '2px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} /></div>
          ) : notifications.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 40, color: '#71717a', fontSize: 13 }}>Aucune notification envoyée</div>
          ) : notifications.map(n => (
            <button key={n._id} onClick={() => setDetail(n)} style={{
              display: 'block', width: '100%', textAlign: 'left', background: '#27272a', borderRadius: 10, padding: 14,
              border: 'none', cursor: 'pointer', transition: 'all 0.15s',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{n.title}</div>
                <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: `${statusColor(n.status)}20`, color: statusColor(n.status) }}>
                  {n.status === 'sent' ? 'Envoyé' : n.status === 'scheduled' ? 'Planifié' : 'Échec'}
                </span>
              </div>
              <div style={{ fontSize: 12, color: '#a1a1aa', marginBottom: 6, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{n.message}</div>
              <div style={{ display: 'flex', gap: 12, fontSize: 10, color: '#52525b' }}>
                <span>🎯 {targetLabel(n.targetType)}</span>
                <span>📊 {s(n.stats?.total || 0)} dest.</span>
                <span>✅ {s(n.stats?.read || 0)} lus</span>
                <span>{n.sentAt ? new Date(n.sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '-'}</span>
              </div>
            </button>
          ))}
        </div>

        {/* Pagination */}
        {meta.total > meta.limit && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
            {Array.from({ length: Math.ceil(meta.total / meta.limit) }, (_, i) => i + 1).map(p => (
              <button key={p} onClick={() => fetchNotifications(p)} style={{
                width: 30, height: 30, borderRadius: 6, fontSize: 12, fontWeight: 600,
                background: meta.page === p ? '#a855f7' : '#27272a',
                border: 'none', color: meta.page === p ? '#fff' : '#71717a', cursor: 'pointer',
              }}>{p}</button>
            ))}
          </div>
        )}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setDetail(null)}>
          <div style={{ background: '#18181b', borderRadius: 16, width: '90%', maxWidth: 480, padding: 24, border: '1px solid #27272a', animation: 'scaleIn 0.2s ease-out' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>{detail.title}</h3>
              <button onClick={() => setDetail(null)} style={{ background: '#27272a', border: 'none', color: '#fff', width: 28, height: 28, borderRadius: 6, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ padding: 12, background: '#27272a', borderRadius: 8, marginBottom: 16, fontSize: 13, color: '#a1a1aa', lineHeight: 1.5 }}>{detail.message}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12, color: '#71717a' }}>
              <div><span style={{ color: '#a1a1aa' }}>Cible</span><br/>{targetLabel(detail.targetType)}</div>
              <div><span style={{ color: '#a1a1aa' }}>Canal</span><br/>{detail.type.toUpperCase()}</div>
              <div><span style={{ color: '#a1a1aa' }}>Statut</span><br/><span style={{ color: statusColor(detail.status) }}>{detail.status === 'sent' ? 'Envoyé' : detail.status === 'scheduled' ? 'Planifié' : 'Échec'}</span></div>
              <div><span style={{ color: '#a1a1aa' }}>Date</span><br/>{detail.sentAt ? new Date(detail.sentAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (detail.scheduledAt ? `Planifié le ${new Date(detail.scheduledAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' })}` : '-')}</div>
            </div>
            <div style={{ marginTop: 16, padding: 12, background: '#27272a', borderRadius: 8 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 8 }}>📊 Statistiques</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, textAlign: 'center' }}>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: '#fff' }}>{s(detail.stats?.total || 0)}</div><div style={{ fontSize: 10, color: '#52525b' }}>Total</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{s(detail.stats?.read || 0)}</div><div style={{ fontSize: 10, color: '#52525b' }}>Lus</div></div>
                <div><div style={{ fontSize: 20, fontWeight: 700, color: detail.stats?.failed > 0 ? '#ef4444' : '#52525b' }}>{s(detail.stats?.failed || 0)}</div><div style={{ fontSize: 10, color: '#52525b' }}>Échecs</div></div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
