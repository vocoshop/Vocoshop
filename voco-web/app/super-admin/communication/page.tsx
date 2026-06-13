'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Store {
  storeId: string;
  storeName: string;
  phone: string;
  city: string;
  subscriptionStatus: string;
}

interface Agent {
  _id: string;
  name: string;
  code: string;
  phone: string;
  city: string;
  isApproved: boolean;
}

interface SentMessage {
  _id: string;
  channel: string;
  recipients: string;
  recipientCount: number;
  subject?: string;
  message: string;
  status: string;
  city?: string;
  createdAt: string;
}

const RECIPIENT_OPTIONS = [
  { value: 'all_stores', label: 'Toutes les boutiques', icon: '🏪' },
  { value: 'all_agents', label: 'Tous les agents', icon: '👤' },
  { value: 'active_stores', label: 'Boutiques actives', icon: '✅' },
  { value: 'stores_by_city', label: 'Boutiques par ville', icon: '🏙️' },
];

const CHANNEL_OPTIONS = [
  { value: 'sms', label: 'SMS', sublabel: "Africa's Talking", icon: '📱', costPerChar: 0.80, maxChars: 160 },
  { value: 'whatsapp', label: 'WhatsApp', sublabel: 'WhatsApp Business', icon: '💬', costPerChar: 0.50, maxChars: 1000 },
];

export default function CommunicationPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [stores, setStores] = useState<Store[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [history, setHistory] = useState<SentMessage[]>([]);

  const [channel, setChannel] = useState('sms');
  const [recipients, setRecipients] = useState('all_stores');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [city, setCity] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [cities, setCities] = useState<string[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotal, setHistoryTotal] = useState(0);

  const getHeaders = useCallback((): Record<string, string> => {
    const t = localStorage.getItem('adminToken');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) { router.push('/admin/login'); return; }

    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const [sr, ar] = await Promise.all([
          fetch(`${API}/admin/stores?limit=1000`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/agents?approved=true&limit=1000`, { headers: h }).catch(() => null),
        ]);
        if (sr?.status === 401 || ar?.status === 401) {
          localStorage.removeItem('adminToken');
          localStorage.removeItem('adminInfo');
          window.location.href = '/admin/login';
          return;
        }
        if (sr?.ok) {
          const sd = await sr.json();
          const storeList = sd.stores || [];
          setStores(storeList);
          const uniqueCities = [...new Set(storeList.map((s: any) => s.city).filter(Boolean))] as string[];
          setCities(uniqueCities.sort());
        }
        if (ar?.ok) {
          const ad = await ar.json();
          setAgents(ad.agents || []);
        }
      } catch {} finally { setLoading(false); }
    })();
  }, [router]);

  const loadHistory = useCallback(async (page = 1) => {
    const t = localStorage.getItem('adminToken');
    if (!t) return;
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10' });
      const r = await fetch(`${API}/admin/communication/history?${params}`, {
        headers: { Authorization: `Bearer ${t}` },
      }).catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        setHistory(d.messages || []);
        setHistoryTotal(d.total || 0);
      } else {
        setHistory([]);
      }
    } catch { setHistory([]); }
  }, []);

  useEffect(() => { loadHistory(historyPage); }, [historyPage, loadHistory]);

  const getRecipientCount = (): number => {
    switch (recipients) {
      case 'all_stores': return stores.length;
      case 'all_agents': return agents.length;
      case 'active_stores': return stores.filter(s => s.subscriptionStatus === 'active').length;
      case 'stores_by_city':
        if (!city) return 0;
        return stores.filter(s => s.city?.toLowerCase() === city.toLowerCase()).length;
      default: return 0;
    }
  };

  const getChannelConfig = () => CHANNEL_OPTIONS.find(c => c.value === channel)!;
  const recipientCount = getRecipientCount();
  const charCount = message.length;
  const channelConfig = getChannelConfig();
  const isOverLimit = charCount > channelConfig.maxChars;
  const estimatedCost = (recipientCount * channelConfig.costPerChar * Math.ceil(Math.max(charCount, 1) / 70)).toFixed(0);

  const getRecipientLabel = (): string => {
    switch (recipients) {
      case 'all_stores': return `Toutes les boutiques (${stores.length})`;
      case 'all_agents': return `Tous les agents (${agents.length})`;
      case 'active_stores': return `Boutiques actives (${stores.filter(s => s.subscriptionStatus === 'active').length})`;
      case 'stores_by_city': return city ? `Boutiques à ${city} (${getRecipientCount()})` : 'Boutiques par ville';
      default: return '';
    }
  };

  const handleSend = async () => {
    setSending(true);
    setError('');
    setSuccess('');
    setShowConfirm(false);
    const t = localStorage.getItem('adminToken');
    if (!t) { setSending(false); return; }

    try {
      const body: any = {
        channel,
        recipients,
        message,
        subject: subject || undefined,
      };
      if (recipients === 'stores_by_city') body.city = city;

      const r = await fetch(`${API}/admin/communication/send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const d = await r.json();
      if (!r.ok) {
        setError(d.error || 'Erreur lors de l\'envoi');
        setSending(false);
        return;
      }

      setSuccess(`Message envoyé avec succès à ${d.recipientCount || recipientCount} destinataire(s)`);
      setMessage('');
      setSubject('');
      setCity('');
      loadHistory(1);
    } catch { setError('Erreur de connexion'); }
    finally { setSending(false); }
  };

  const canSend = message.trim().length > 0 && recipientCount > 0 && !isOverLimit;

  const formatDate = (d: string) => {
    return new Date(d).toLocaleDateString('fr-FR', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const channelBadge = (ch: string) => {
    if (ch === 'sms') return { bg: '#3b82f620', color: '#3b82f6', label: 'SMS' };
    if (ch === 'whatsapp') return { bg: '#22c55e20', color: '#22c55e', label: 'WhatsApp' };
    return { bg: '#71717a20', color: '#71717a', label: ch };
  };

  const statusBadge = (st: string) => {
    if (st === 'sent' || st === 'delivered') return { bg: '#22c55e20', color: '#22c55e', label: st === 'sent' ? 'Envoyé' : 'Livrée' };
    if (st === 'pending') return { bg: '#eab30820', color: '#eab308', label: 'En attente' };
    if (st === 'failed') return { bg: '#ef444420', color: '#ef4444', label: 'Échoué' };
    return { bg: '#71717a20', color: '#71717a', label: st };
  };

  const historyTotalPages = Math.max(1, Math.ceil(historyTotal / 10));

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '50vh' }}>
        <div style={{ width: 32, height: 32, border: '2px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  return (
    <div>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @media (max-width: 768px) {
          .comm-grid { grid-template-columns: 1fr !important; }
          .comm-history-section { min-height: auto !important; }
        }
      `}</style>

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Communication</h2>
        <p style={{ fontSize: 13, color: '#71717a', margin: '4px 0 0' }}>Envoyez des SMS et WhatsApp aux boutiques et agents</p>
      </div>

      <div className="comm-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, minHeight: 'calc(100vh - 120px)' }}>

        {/* LEFT — Compose */}
        <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', padding: 24, display: 'flex', flexDirection: 'column' }}>
          <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>✏️ Composer un message</h2>
          <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>Choisissez le canal, les destinataires et rédigez votre message</p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, flex: 1 }}>

            {/* Channel selector */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Canal d'envoi</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {CHANNEL_OPTIONS.map(c => (
                  <button key={c.value} type="button" onClick={() => setChannel(c.value)} style={{
                    flex: 1, padding: '12px 14px', borderRadius: 10, fontSize: 13, fontWeight: 500,
                    background: channel === c.value ? '#a855f720' : '#09090b',
                    border: `1px solid ${channel === c.value ? '#a855f7' : '#27272a'}`,
                    color: channel === c.value ? '#a855f7' : '#71717a', cursor: 'pointer',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
                  }}>
                    <span style={{ fontSize: 20 }}>{c.icon}</span>
                    <span style={{ fontWeight: 600 }}>{c.label}</span>
                    <span style={{ fontSize: 10, color: '#52525b' }}>{c.sublabel}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Recipient selector */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Destinataires</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                {RECIPIENT_OPTIONS.map(opt => (
                  <button key={opt.value} type="button" onClick={() => { setRecipients(opt.value); setCity(''); }} style={{
                    padding: '10px 12px', borderRadius: 8, fontSize: 12, fontWeight: 500,
                    background: recipients === opt.value ? '#a855f720' : '#27272a',
                    border: `1px solid ${recipients === opt.value ? '#a855f7' : '#27272a'}`,
                    color: recipients === opt.value ? '#a855f7' : '#71717a', cursor: 'pointer',
                    display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left',
                  }}>
                    <span style={{ fontSize: 14 }}>{opt.icon}</span>
                    <span>{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* City selector */}
            {recipients === 'stores_by_city' && (
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Ville</label>
                {cities.length > 0 ? (
                  <select value={city} onChange={e => setCity(e.target.value)} style={{
                    padding: '10px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#09090b',
                    color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none',
                    cursor: 'pointer',
                  }}>
                    <option value="">Sélectionnez une ville</option>
                    {cities.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                ) : (
                  <input value={city} onChange={e => setCity(e.target.value)} placeholder="Tapez le nom de la ville..." style={{
                    padding: '10px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#09090b',
                    color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none',
                  }} />
                )}
              </div>
            )}

            {/* Subject */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Objet (optionnel)</label>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Objet du message..." style={{
                padding: '10px 12px', borderRadius: 8, border: '1px solid #27272a', background: '#09090b',
                color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box', outline: 'none',
              }} />
            </div>

            {/* Message */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Message *</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Rédigez votre message ici..."
                required
                style={{
                  flex: 1, minHeight: 120, padding: '12px', borderRadius: 8, border: `1px solid ${isOverLimit ? '#ef4444' : '#27272a'}`,
                  background: '#09090b', color: '#fff', fontSize: 13, width: '100%', boxSizing: 'border-box',
                  outline: 'none', resize: 'vertical', fontFamily: 'inherit', lineHeight: 1.5,
                }}
              />
              <div style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6,
                fontSize: 11, color: isOverLimit ? '#ef4444' : '#52525b',
              }}>
                <span>{charCount} / {channelConfig.maxChars} caractères</span>
                {isOverLimit && <span style={{ color: '#ef4444', fontWeight: 600 }}>Dépassement de limite</span>}
              </div>
            </div>

            {/* Cost & Recipient Info */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              <div style={{ padding: '12px', borderRadius: 8, background: '#09090b', border: '1px solid #27272a' }}>
                <div style={{ fontSize: 10, color: '#52525b', marginBottom: 4 }}>Destinataires</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#a855f7' }}>{recipientCount}</div>
                <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{getRecipientLabel()}</div>
              </div>
              <div style={{ padding: '12px', borderRadius: 8, background: '#09090b', border: '1px solid #27272a' }}>
                <div style={{ fontSize: 10, color: '#52525b', marginBottom: 4 }}>Coût estimé</div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#eab308' }}>{estimatedCost} FCFA</div>
                <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>{channelConfig.costPerChar} FCFA/car. × {recipientCount} dest.</div>
              </div>
            </div>

            {error && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#ef444415', color: '#ef4444', fontSize: 13, textAlign: 'center' }}>{error}</div>}
            {success && <div style={{ padding: '10px 14px', borderRadius: 8, background: '#22c55e15', color: '#22c55e', fontSize: 13, textAlign: 'center' }}>{success}</div>}

            {/* Send button */}
            <button
              type="button"
              onClick={() => canSend && setShowConfirm(true)}
              disabled={!canSend || sending}
              style={{
                padding: '14px 20px', borderRadius: 10,
                background: canSend && !sending ? 'linear-gradient(135deg, #a855f7, #7c3aed)' : '#27272a',
                border: 'none', color: canSend && !sending ? '#fff' : '#52525b',
                fontSize: 14, fontWeight: 600, cursor: canSend && !sending ? 'pointer' : 'not-allowed',
                opacity: sending ? 0.6 : 1,
                transition: 'all 0.15s',
              }}
            >
              {sending ? '⏳ Envoi en cours...' : `🚀 Envoyer à ${recipientCount} destinataire(s)`}
            </button>
          </div>
        </div>

        {/* RIGHT — History */}
        <div className="comm-history-section" style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', padding: 24, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>📋 Historique</h2>
              <p style={{ fontSize: 12, color: '#71717a', margin: '2px 0 0' }}>{historyTotal} message(s) envoyé(s)</p>
            </div>
            <button onClick={() => loadHistory(historyPage)} style={{
              padding: '6px 12px', borderRadius: 8, background: '#27272a', border: 'none',
              color: '#a1a1aa', fontSize: 12, cursor: 'pointer',
            }}>↻ Actualiser</button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 60, background: '#09090b', borderRadius: 12, border: '1px solid #27272a' }}>
                <div style={{ fontSize: 40, marginBottom: 12 }}>📨</div>
                <div style={{ color: '#71717a', fontSize: 14 }}>Aucun message envoyé</div>
                <div style={{ color: '#52525b', fontSize: 12, marginTop: 4 }}>Commencez par composer un message</div>
              </div>
            ) : history.map(msg => {
              const chBadge = channelBadge(msg.channel);
              const stBadge = statusBadge(msg.status);
              return (
                <div key={msg._id} style={{
                  background: '#09090b', borderRadius: 10, padding: 16,
                  border: '1px solid #27272a', transition: 'border-color 0.15s',
                }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a855f740')}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#27272a')}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: chBadge.bg, color: chBadge.color,
                      }}>{chBadge.label}</span>
                      <span style={{
                        padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 600,
                        background: stBadge.bg, color: stBadge.color,
                      }}>{stBadge.label}</span>
                    </div>
                    <span style={{ fontSize: 11, color: '#52525b' }}>{formatDate(msg.createdAt)}</span>
                  </div>
                  {msg.subject && (
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 4 }}>{msg.subject}</div>
                  )}
                  <div style={{
                    fontSize: 12, color: '#a1a1aa', marginBottom: 8,
                    display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
                    lineHeight: 1.4,
                  }}>{msg.message}</div>
                  <div style={{ display: 'flex', gap: 12, fontSize: 11, color: '#52525b' }}>
                    <span>👥 {msg.recipientCount} destinataire(s)</span>
                    <span>🎯 {msg.recipients === 'all_stores' ? 'Toutes les boutiques' : msg.recipients === 'all_agents' ? 'Tous les agents' : msg.recipients === 'active_stores' ? 'Boutiques actives' : msg.recipients === 'stores_by_city' ? `Ville: ${msg.city || '-'}` : msg.recipients}</span>
                  </div>
                </div>
              );
            })}
          </div>

          {historyTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 12 }}>
              <button onClick={() => setHistoryPage(p => Math.max(1, p - 1))} disabled={historyPage <= 1} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', background: '#27272a',
                color: '#A8A3C2', cursor: historyPage <= 1 ? 'default' : 'pointer', opacity: historyPage <= 1 ? 0.4 : 1, fontSize: 12,
              }}>← Préc</button>
              {Array.from({ length: historyTotalPages }, (_, i) => i + 1).map(p => (
                <button key={p} onClick={() => setHistoryPage(p)} style={{
                  width: 30, height: 30, borderRadius: 6, fontSize: 12, fontWeight: 600,
                  background: historyPage === p ? '#a855f7' : '#27272a',
                  border: 'none', color: historyPage === p ? '#fff' : '#71717a', cursor: 'pointer',
                }}>{p}</button>
              ))}
              <button onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))} disabled={historyPage >= historyTotalPages} style={{
                padding: '6px 12px', borderRadius: 8, border: 'none', background: '#27272a',
                color: '#A8A3C2', cursor: historyPage >= historyTotalPages ? 'default' : 'pointer', opacity: historyPage >= historyTotalPages ? 0.4 : 1, fontSize: 12,
              }}>Suiv →</button>
            </div>
          )}
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirm && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }} onClick={() => setShowConfirm(false)}>
          <div style={{
            background: '#18181b', borderRadius: 16, padding: 24, maxWidth: 480, width: '100%',
            border: '1px solid #27272a',
          }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fff', margin: 0 }}>Confirmer l'envoi</h3>
              <button onClick={() => setShowConfirm(false)} style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ background: '#09090b', borderRadius: 10, padding: 16, border: '1px solid #27272a', marginBottom: 16 }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: channel === 'sms' ? '#3b82f620' : '#22c55e20', color: channel === 'sms' ? '#3b82f6' : '#22c55e' }}>
                  {channel === 'sms' ? '📱 SMS' : '💬 WhatsApp'}
                </span>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#a855f720', color: '#a855f7' }}>
                  👥 {recipientCount} destinataire(s)
                </span>
              </div>
              {subject && (
                <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 6 }}>
                  📌 {subject}
                </div>
              )}
              <div style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{message}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, marginBottom: 16 }}>
              <div style={{ textAlign: 'center', padding: '10px 0', background: '#09090b', borderRadius: 8, border: '1px solid #27272a' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#a855f7' }}>{recipientCount}</div>
                <div style={{ fontSize: 10, color: '#52525b' }}>Destinataires</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 0', background: '#09090b', borderRadius: 8, border: '1px solid #27272a' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>{charCount}</div>
                <div style={{ fontSize: 10, color: '#52525b' }}>Caractères</div>
              </div>
              <div style={{ textAlign: 'center', padding: '10px 0', background: '#09090b', borderRadius: 8, border: '1px solid #27272a' }}>
                <div style={{ fontSize: 18, fontWeight: 700, color: '#eab308' }}>{estimatedCost}</div>
                <div style={{ fontSize: 10, color: '#52525b' }}>FCFA estimés</div>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowConfirm(false)} style={{
                flex: 1, padding: '12px', borderRadius: 10, background: '#27272a',
                border: 'none', color: '#a1a1aa', fontSize: 13, fontWeight: 600, cursor: 'pointer',
              }}>Annuler</button>
              <button onClick={handleSend} disabled={sending} style={{
                flex: 1, padding: '12px', borderRadius: 10,
                background: sending ? '#52525b' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                border: 'none', color: '#fff', fontSize: 13, fontWeight: 600,
                cursor: sending ? 'not-allowed' : 'pointer', opacity: sending ? 0.6 : 1,
              }}>
                {sending ? '⏳ Envoi...' : '🚀 Confirmer l\'envoi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
