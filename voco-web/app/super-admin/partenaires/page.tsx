'use client';

import { useState, useEffect, useCallback } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Partner {
  _id: string;
  name: string;
  type: string;
  email: string;
  phone: string;
  min: number;
  max: number;
  responseTime: string;
  rate: string;
  active: boolean;
  order: number;
  createdAt: string;
}

const EMPTY: Partner = {
  _id: '', name: '', type: 'Microfinance', email: '', phone: '',
  min: 0, max: 0, responseTime: '', rate: '', active: true, order: 0, createdAt: '',
};

export default function PartenairesPage() {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(false);
  const [editing, setEditing] = useState<Partner>(EMPTY);
  const [isEdit, setIsEdit] = useState(false);
  const [saving, setSaving] = useState(false);

  const getHeaders = useCallback((): Record<string, string> => {
    const t = localStorage.getItem('adminToken');
    return t ? { Authorization: `Bearer ${t}` } : {};
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${API}/admin/partners`, { headers: getHeaders() });
      if (!res.ok) {
        console.error('Erreur chargement partenaires:', res.status);
        setPartners([]);
      } else {
        const data = await res.json();
        setPartners(data.partners || []);
      }
    } catch (e) {
      console.error('Erreur réseau chargement:', e);
    }
    setLoading(false);
  }, [getHeaders]);

  useEffect(() => { load(); }, [load]);

  const openCreate = () => { setEditing({ ...EMPTY }); setIsEdit(false); setModal(true); };
  const openEdit = (p: Partner) => { setEditing({ ...p }); setIsEdit(true); setModal(true); };

  const save = async () => {
    if (!editing.name.trim() || !editing.email.trim()) return;
    setSaving(true);
    try {
      const method = isEdit ? 'PUT' : 'POST';
      const url = isEdit ? `${API}/admin/partners/${editing._id}` : `${API}/admin/partners`;
      const res = await fetch(url, {
        method,
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify(editing),
      });
      if (!res.ok) {
        const err = await res.text();
        console.error('Erreur création partenaire:', res.status, err);
        alert(`Erreur ${res.status}: ${err}`);
        setSaving(false);
        return;
      }
      setModal(false);
      await load();
    } catch (e) {
      console.error('Erreur réseau:', e);
      alert('Erreur réseau: impossible de contacter le serveur');
    }
    setSaving(false);
  };

  const remove = async (p: Partner) => {
    if (!confirm(`Supprimer "${p.name}" ?`)) return;
    try {
      await fetch(`${API}/admin/partners/${p._id}`, { method: 'DELETE', headers: getHeaders() });
      load();
    } catch {}
  };

  const toggleActive = async (p: Partner) => {
    try {
      await fetch(`${API}/admin/partners/${p._id}`, {
        method: 'PUT',
        headers: { ...getHeaders(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: !p.active }),
      });
      load();
    } catch {}
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#fff', margin: 0 }}>Partenaires Financiers</h2>
          <p style={{ fontSize: 13, color: '#71717a', margin: '4px 0 0' }}>Gère les microfinances et banques partenaires</p>
        </div>
        <button onClick={openCreate} style={{
          padding: '10px 20px', borderRadius: 10, background: '#a855f7', color: '#fff',
          border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
        }}>
          + Nouveau partenaire
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 40, textAlign: 'center', color: '#52525b' }}>Chargement...</div>
      ) : partners.length === 0 ? (
        <div style={{ padding: 60, textAlign: 'center', background: '#18181b', borderRadius: 12, border: '1px solid #27272a' }}>
          <div style={{ fontSize: 40, marginBottom: 12 }}>🏢</div>
          <div style={{ color: '#71717a', fontSize: 14 }}>Aucun partenaire</div>
          <button onClick={openCreate} style={{
            marginTop: 16, padding: '10px 20px', borderRadius: 10, background: '#a855f7',
            color: '#fff', border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
          }}>+ Ajouter un partenaire</button>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12 }}>
          {partners.map(p => (
            <div key={p._id} style={{
              background: '#18181b', borderRadius: 12, border: '1px solid #27272a',
              padding: 20, opacity: p.active ? 1 : 0.5,
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 10, background: '#a855f720',
                      display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
                    }}>🏢</div>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>{p.name}</div>
                      <div style={{ fontSize: 12, color: '#a855f7' }}>{p.type}</div>
                    </div>
                    <span style={{
                      padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600,
                      background: p.active ? '#22c55e20' : '#ef444420',
                      color: p.active ? '#22c55e' : '#ef4444',
                    }}>{p.active ? 'Actif' : 'Inactif'}</span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginTop: 12 }}>
                    <div>
                      <div style={{ fontSize: 11, color: '#52525b', marginBottom: 2 }}>Email</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>{p.email}</div>
                    </div>
                    {p.phone && <div>
                      <div style={{ fontSize: 11, color: '#52525b', marginBottom: 2 }}>Téléphone</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>{p.phone}</div>
                    </div>}
                    <div>
                      <div style={{ fontSize: 11, color: '#52525b', marginBottom: 2 }}>Montants</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>
                        {(p.min / 1000).toFixed(0)}K — {(p.max / 1000).toFixed(0)}K FCFA
                      </div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#52525b', marginBottom: 2 }}>Taux</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>{p.rate}</div>
                    </div>
                    <div>
                      <div style={{ fontSize: 11, color: '#52525b', marginBottom: 2 }}>Délai</div>
                      <div style={{ fontSize: 13, color: '#d4d4d8' }}>{p.responseTime}</div>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button onClick={() => toggleActive(p)} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: p.active ? '#22c55e20' : '#ef444420',
                    color: p.active ? '#22c55e' : '#ef4444', border: 'none', cursor: 'pointer',
                  }}>{p.active ? 'Désactiver' : 'Activer'}</button>
                  <button onClick={() => openEdit(p)} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: '#a855f720', color: '#a855f7', border: 'none', cursor: 'pointer',
                  }}>Modifier</button>
                  <button onClick={() => remove(p)} style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 600,
                    background: '#ef444420', color: '#ef4444', border: 'none', cursor: 'pointer',
                  }}>Supprimer</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* MODAL */}
      {modal && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 500,
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
        }} onClick={() => setModal(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            background: '#18181b', borderRadius: 16, border: '1px solid #27272a',
            width: '100%', maxWidth: 520, maxHeight: '90vh', overflow: 'auto',
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #27272a',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#fff' }}>
                {isEdit ? 'Modifier le partenaire' : 'Nouveau partenaire'}
              </h3>
              <button onClick={() => setModal(false)} style={{
                background: '#27272a', border: 'none', color: '#a1a1aa', width: 32, height: 32,
                borderRadius: 8, cursor: 'pointer', fontSize: 14,
              }}>✕</button>
            </div>

            <div style={{ padding: 20 }}>
              {[
                { label: 'Nom *', key: 'name', placeholder: 'Microfinance Soleil' },
                { label: 'Email *', key: 'email', placeholder: 'contact@microfinance.cg', type: 'email' },
                { label: 'Téléphone', key: 'phone', placeholder: '+242 06 XXX XXX', prefix: '+242' },
              ].map(f => (
                <div key={f.key} style={{ marginBottom: 16 }}>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 6 }}>{f.label}</label>
                  <input
                    value={(editing as any)[f.key]}
                    onChange={e => {
                      let v = e.target.value;
                      if (f.key === 'phone' && v && !v.startsWith('+') && !v.startsWith('0')) {
                        v = '+242' + v.replace(/^242/, '');
                      }
                      setEditing({ ...editing, [f.key]: v });
                    }}
                    placeholder={f.placeholder}
                    type={(f as any).type || 'text'}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      background: '#0a0a0b', border: '1px solid #27272a', color: '#fff',
                      fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
              ))}

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 6 }}>Type</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {['Microfinance', 'Banque', 'Financement'].map(t => (
                    <button key={t} onClick={() => setEditing({ ...editing, type: t })} style={{
                      padding: '8px 16px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                      background: editing.type === t ? '#a855f720' : '#0a0a0b',
                      border: `1px solid ${editing.type === t ? '#a855f7' : '#27272a'}`,
                      color: editing.type === t ? '#a855f7' : '#71717a', cursor: 'pointer',
                    }}>{t}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 6 }}>Montant min (FCFA)</label>
                  <input
                    value={editing.min ? editing.min.toLocaleString('fr-FR') : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                      setEditing({ ...editing, min: parseInt(raw) || 0 });
                    }}
                    placeholder="100 000"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      background: '#0a0a0b', border: '1px solid #27272a', color: '#fff',
                      fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 6 }}>Montant max (FCFA)</label>
                  <input
                    value={editing.max ? editing.max.toLocaleString('fr-FR') : ''}
                    onChange={e => {
                      const raw = e.target.value.replace(/\s/g, '').replace(/\D/g, '');
                      setEditing({ ...editing, max: parseInt(raw) || 0 });
                    }}
                    placeholder="5 000 000"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      background: '#0a0a0b', border: '1px solid #27272a', color: '#fff',
                      fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 6 }}>Taux d'intérêt</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={editing.rate}
                      onChange={e => {
                        let v = e.target.value.replace(/[^0-9.,]/g, '').replace(',', '.');
                        if (v && !v.includes('%')) {
                          const num = parseFloat(v);
                          if (!isNaN(num)) v = num + '%/mois';
                        }
                        setEditing({ ...editing, rate: v });
                      }}
                      placeholder="3.5"
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 8,
                        background: '#0a0a0b', border: '1px solid #27272a', color: '#fff',
                        fontSize: 14, outline: 'none',
                      }}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 6 }}>Délai de réponse</label>
                  <div style={{ position: 'relative' }}>
                    <input
                      value={editing.responseTime}
                      onChange={e => {
                        let v = e.target.value;
                        const digits = v.replace(/\D/g, '');
                        if (digits && !v.match(/\d+\s*(heure|jour|mois)/i)) {
                          const n = parseInt(digits);
                          if (n > 0) {
                            if (n >= 30 && n % 30 === 0) v = n + ' jours';
                            else if (n >= 24 && n < 72) v = n + ' heures';
                            else v = n + ' heures';
                          }
                        }
                        setEditing({ ...editing, responseTime: v });
                      }}
                      placeholder="72 heures"
                      style={{
                        width: '100%', padding: '10px 14px', borderRadius: 8,
                        background: '#0a0a0b', border: '1px solid #27272a', color: '#fff',
                        fontSize: 14, outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 6 }}>Ordre d'affichage</label>
                  <input
                    value={editing.order || ''}
                    onChange={e => setEditing({ ...editing, order: parseInt(e.target.value) || 0 })}
                    placeholder="1"
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 8,
                      background: '#0a0a0b', border: '1px solid #27272a', color: '#fff',
                      fontSize: 14, outline: 'none',
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#71717a', marginBottom: 6 }}>Statut</label>
                  <button onClick={() => setEditing({ ...editing, active: !editing.active })} style={{
                    width: '100%', padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 600,
                    background: editing.active ? '#22c55e20' : '#ef444420',
                    border: `1px solid ${editing.active ? '#22c55e' : '#ef4444'}`,
                    color: editing.active ? '#22c55e' : '#ef4444', cursor: 'pointer',
                  }}>{editing.active ? 'Actif' : 'Inactif'}</button>
                </div>
              </div>
            </div>

            <div style={{
              padding: '16px 20px', borderTop: '1px solid #27272a',
              display: 'flex', gap: 12, justifyContent: 'flex-end',
            }}>
              <button onClick={() => setModal(false)} style={{
                padding: '10px 20px', borderRadius: 8, background: '#27272a', color: '#a1a1aa',
                border: 'none', fontWeight: 600, fontSize: 13, cursor: 'pointer',
              }}>Annuler</button>
              <button onClick={save} disabled={saving} style={{
                padding: '10px 20px', borderRadius: 8, background: '#a855f7', color: '#fff',
                border: 'none', fontWeight: 700, fontSize: 13, cursor: 'pointer', opacity: saving ? 0.5 : 1,
              }}>{saving ? 'Enregistrement...' : isEdit ? 'Enregistrer' : 'Créer'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
