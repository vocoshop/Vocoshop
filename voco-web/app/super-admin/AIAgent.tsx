'use client';

import { useState, useRef, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type Message = { role: 'user' | 'assistant'; content: string; type?: string };

const QUICK_ACTIONS = [
  { label: 'Analyse plateforme', query: 'Analyse de la plateforme' },
  { label: 'Veille sécurité', query: 'Rapport de sécurité' },
  { label: 'Revenus mensuels', query: 'Combien avons-nous gagné ce mois-ci?' },
  { label: 'Alertes actives', query: 'Quelles sont les alertes importantes?' },
  { label: 'Top agents', query: 'Qui sont les meilleurs agents?' },
];

export default function AIAgent() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Bonjour Don Carly ! Je suis VocoAI.\n\nJe peux :\n• 📊 Analyser vos stats et revenus\n• 🔒 Faire la veille sécurité\n• ⚡ Intervenir (suspendre, activer, approuver)\n• 💡 Vous conseiller\n\nQue puis-je faire pour vous ?', type: 'intro' }
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async (msgText?: string) => {
    const userMsg = msgText || input.trim();
    if (!userMsg || loading) return;
    setInput('');
    setMessages(m => [...m, { role: 'user', content: userMsg }]);
    setLoading(true);

    try {
      const token = localStorage.getItem('adminToken');
      const contextMessages = messages
        .filter(m => m.type !== 'intro')
        .slice(-8)
        .map((m, i) => ({
          role: m.role === 'user' ? 'user' : 'model',
          parts: [{ text: m.content }],
        }));
      contextMessages.push({ role: 'user', parts: [{ text: userMsg }] });

      const res = await fetch(`${API}/ai/admin-chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ messages: contextMessages }),
      });

      const data = await res.json().catch(() => ({}));
      const reply = data.reply || "Je n'ai pas pu traiter votre demande.";
      setMessages(m => [...m, { role: 'assistant', content: reply }]);
    } catch {
      setMessages(m => [...m, { role: 'assistant', content: 'Désolé, je rencontre un problème de connexion.' }]);
    }
    setLoading(false);
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        style={{
          position: 'fixed',
          bottom: 24,
          right: 24,
          width: 60,
          height: 60,
          borderRadius: '50%',
          background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
          border: 'none',
          cursor: 'pointer',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 8px 32px rgba(168, 85, 247, 0.4)',
          fontSize: 24,
        }}
        title="VocoAI Assistant"
      >
        🤖
      </button>
    );
  }

  return (
    <div style={{
      position: 'fixed',
      bottom: minimized ? 24 : undefined,
      right: 24,
      width: minimized ? 60 : 400,
      height: minimized ? 60 : 560,
      borderRadius: minimized ? '50%' : 20,
      background: '#18181b',
      border: '1px solid #27272a',
      boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      zIndex: 500,
      display: 'flex',
      flexDirection: minimized ? 'row' : 'column',
      overflow: 'hidden',
      transition: 'all 0.3s ease',
    }}>
      {minimized ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', gap: 8 }}>
          <span style={{ fontSize: 24 }}>🤖</span>
          <button
            onClick={(e) => { e.stopPropagation(); setMinimized(false); }}
            style={{
              position: 'absolute',
              top: -8,
              right: -8,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: '#ef4444',
              border: 'none',
              color: '#fff',
              fontSize: 12,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >✕</button>
        </div>
      ) : (
        <>
          <div style={{
            padding: '14px 16px',
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 20 }}>🤖</span>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>VocoAI</div>
                <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>Assistant intelligent</div>
              </div>
            </div>
            <button
              onClick={() => setMinimized(true)}
              style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 18 }}
            >—</button>
          </div>

          <div style={{ flex: 1, overflow: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {messages.map((m, i) => (
              <div key={i} style={{
                padding: '10px 14px',
                borderRadius: 12,
                maxWidth: '88%',
                fontSize: 13,
                lineHeight: 1.5,
                whiteSpace: 'pre-wrap',
                background: m.role === 'user' ? '#a855f720' : '#27272a',
                color: '#fafafa',
                alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                {m.content}
              </div>
            ))}
            {loading && (
              <div style={{ padding: '10px 14px', borderRadius: 12, background: '#27272a', fontSize: 13, color: '#71717a', alignSelf: 'flex-start', display: 'flex', gap: 6, alignItems: 'center' }}>
                <span style={{ animation: 'pulse 1s infinite' }}>●</span> VocoAI réfléchit...
              </div>
            )}

            {!loading && messages.length > 1 && (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 4 }}>
                {QUICK_ACTIONS.map((a, i) => (
                  <button key={i} onClick={() => sendMessage(a.query)} style={{
                    padding: '5px 10px',
                    background: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: 20,
                    color: '#a1a1aa',
                    fontSize: 11,
                    cursor: 'pointer',
                  }}>
                    {a.label}
                  </button>
                ))}
              </div>
            )}

            <div ref={bottomRef} />
          </div>

          <div style={{ padding: 12, borderTop: '1px solid #27272a', display: 'flex', gap: 8, flexShrink: 0 }}>
            <input
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendMessage()}
              placeholder="Posez une question..."
              style={{
                flex: 1,
                padding: '8px 12px',
                background: '#27272a',
                border: '1px solid #27272a',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                outline: 'none',
              }}
            />
            <button
              onClick={() => sendMessage()}
              disabled={loading || !input.trim()}
              style={{
                padding: '8px 16px',
                background: '#a855f7',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                fontSize: 13,
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.5 : 1,
              }}
            >
              →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
