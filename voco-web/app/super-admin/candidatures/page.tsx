'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function CandidaturesPage() {
  const router = useRouter();
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: string } | null>(null);

  const showToast = (msg: string, type: string) => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  const getHeaders = useCallback((): Record<string, string> => {
    const t = localStorage.getItem('adminToken');
    if (!t) return {};
    return { Authorization: `Bearer ${t}` };
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/admin/agents?approved=pending&limit=500`, { headers: getHeaders() });
      if (res.ok) {
        const data = await res.json();
        setAgents(data.agents || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [getHeaders]);

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (!t) { router.push('/admin/login'); return; }
    load();
  }, [load, router]);

  const approve = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/admin/agents/${id}/approve`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ sendSms: true }),
      });
      const data = await res.json();
      if (res.ok) {
        showToast(`${data.agent?.name || 'Agent'} approuvé !`, 'success');
        setSelected(null);
        load();
      } else {
        showToast(data.error || 'Erreur', 'error');
      }
    } catch (e) { showToast('Erreur réseau', 'error'); }
    setActionLoading(false);
  };

  const reject = async (id: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API}/admin/agents/${id}/reject`, {
        method: 'POST',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        showToast('Candidat rejeté', 'success');
        setSelected(null);
        load();
      }
    } catch (e) { showToast('Erreur réseau', 'error'); }
    setActionLoading(false);
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '40vh', color: '#71717a' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      {toast && (
        <div style={{ position: 'fixed', top: 20, right: 20, zIndex: 9999, padding: '12px 20px', borderRadius: 10, background: toast.type === 'success' ? '#22c55e20' : '#ef444420', border: `1px solid ${toast.type === 'success' ? '#22c55e' : '#ef4444'}`, color: toast.type === 'success' ? '#22c55e' : '#ef4444', fontSize: 13, fontWeight: 500, backdropFilter: 'blur(8px)' }}>
          {toast.msg}
        </div>
      )}

      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: 0 }}>📋 Candidatures en attente</h2>
        <p style={{ fontSize: 12, color: '#71717a', margin: '4px 0 0' }}>{agents.length} candidature(s) à valider</p>
      </div>

      {agents.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#18181b', borderRadius: 12, border: '1px solid #27272a' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>✅</div>
          <div style={{ color: '#71717a', fontSize: 14 }}>Aucune candidature en attente</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {agents.map((a) => (
            <div key={a._id || a.id} onClick={() => setSelected(a)} style={{
              background: '#18181b', borderRadius: 12, border: '1px solid #27272a',
              padding: 20, cursor: 'pointer', transition: 'border-color 0.2s',
            }}
              onMouseEnter={(e) => (e.currentTarget.style.borderColor = '#a855f740')}
              onMouseLeave={(e) => (e.currentTarget.style.borderColor = '#27272a')}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{ width: 36, height: 36, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff' }}>
                      {(a.firstName || a.name || '?')[0]}
                    </div>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{a.firstName} {a.lastName || a.name}</div>
                      <div style={{ fontSize: 11, color: '#a855f7', fontFamily: 'monospace' }}>{a.code || 'En attente de code'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginTop: 8 }}>
                    <div>
                      <div style={{ fontSize: 10, color: '#52525b' }}>Téléphone</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>{a.phone || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#52525b' }}>Ville</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>{a.city || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#52525b' }}>Pays</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>{a.country || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#52525b' }}>Pièce</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>{a.idType || '—'} — {a.idNumber || '—'}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 10, color: '#52525b' }}>Date</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>{fmtDate(a.createdAt)}</div>
                    </div>
                  </div>
                </div>
                <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: '#FACC1520', color: '#FACC15', whiteSpace: 'nowrap' }}>
                  En attente
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL DÉTAIL */}
      {selected && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20,
        }} onClick={() => setSelected(null)}>
          <div style={{
            background: '#18181b', borderRadius: 16, padding: 24, maxWidth: 500, width: '100%',
            maxHeight: '85vh', overflow: 'auto', border: '1px solid #27272a',
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ color: '#fff', fontSize: 18, fontWeight: 800, margin: 0 }}>Détail candidature</h3>
              <button onClick={() => setSelected(null)} style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>

            <div style={{ display: 'grid', gap: 8 }}>
              <Row label="Nom" value={`${selected.firstName || ''} ${selected.lastName || selected.name || ''}`} />
              <Row label="Téléphone" value={selected.phone || '—'} />
              <Row label="Ville" value={selected.city || '—'} />
              <Row label="Pays" value={selected.country || '—'} />
              <Row label="Genre" value={selected.gender === 'M' ? 'Homme' : selected.gender === 'F' ? 'Femme' : '—'} />
              <Row label="Date de naissance" value={selected.birthDate ? new Date(selected.birthDate).toLocaleDateString('fr-FR') : '—'} />
              <Row label="Type de pièce" value={selected.idType || '—'} />
              <Row label="Numéro de pièce" value={selected.idNumber || '—'} />
              <Row label="Code agent" value={selected.code || '—'} />
              <Row label="Date candidature" value={selected.createdAt ? fmtDate(selected.createdAt) : '—'} />
            </div>

            <div style={{ display: 'flex', gap: 8, marginTop: 24 }}>
              <button onClick={() => approve(selected._id || selected.id)} disabled={actionLoading} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#22c55e', color: '#000',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1,
              }}>{actionLoading ? '...' : '✅ Approuver'}</button>
              <button onClick={() => reject(selected._id || selected.id)} disabled={actionLoading} style={{
                flex: 1, padding: '12px', borderRadius: 10, border: 'none', background: '#ef4444', color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: actionLoading ? 0.6 : 1,
              }}>{actionLoading ? '...' : '❌ Rejeter'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #27272a' }}>
      <span style={{ color: '#71717a', fontSize: 13 }}>{label}</span>
      <span style={{ color: '#d4d4d8', fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '60%' }}>{value}</span>
    </div>
  );
}
