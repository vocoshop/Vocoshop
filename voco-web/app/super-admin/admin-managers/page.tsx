'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function AdminManagersPage() {
  const router = useRouter();
  const [managers, setManagers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ email: '', password: '', firstName: '', lastName: '', phone: '', assignedRegions: '', assignedCities: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('adminToken');
    if (!token) { router.push('/admin/login'); return; }
    fetchManagers();
  }, []);

  const headers = () => {
    const t = localStorage.getItem('adminToken');
    return { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' };
  };

  const fetchManagers = async () => {
    try {
      const res = await fetch(`${API}/admin/admin-managers`, { headers: headers() });
      const data = await res.json();
      setManagers(data.managers || []);
    } catch {} finally { setLoading(false); }
  };

  const handleSubmit = async (e: any) => {
    e.preventDefault();
    setError('');
    try {
      const body = {
        ...form,
        assignedRegions: form.assignedRegions.split(',').map((s: string) => s.trim()).filter(Boolean),
        assignedCities: form.assignedCities.split(',').map((s: string) => s.trim()).filter(Boolean),
      };
      const res = await fetch(`${API}/admin/admin-managers${editId ? `/${editId}` : ''}`, {
        method: editId ? 'PATCH' : 'POST',
        headers: headers(),
        body: JSON.stringify(editId ? { ...body, password: body.password || undefined } : body),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur'); return; }
      setShowForm(false); setEditId(null); setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', assignedRegions: '', assignedCities: '' });
      fetchManagers();
    } catch { setError('Erreur serveur'); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Supprimer cet Admin Manager ?')) return;
    try {
      await fetch(`${API}/admin/admin-managers/${id}`, { method: 'DELETE', headers: headers() });
      fetchManagers();
    } catch {}
  };

  const openEdit = (m: any) => {
    setForm({ email: m.email, password: '', firstName: m.firstName, lastName: m.lastName, phone: m.phone || '', assignedRegions: (m.assignedRegions || []).join(', '), assignedCities: (m.assignedCities || []).join(', ') });
    setEditId(m._id);
    setShowForm(true);
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: 0 }}>Admin Managers</h1>
        <button onClick={() => { setShowForm(true); setEditId(null); setForm({ email: '', password: '', firstName: '', lastName: '', phone: '', assignedRegions: '', assignedCities: '' }); }} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', borderRadius: 8, color: '#fff', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
          + Nouvel Admin Manager
        </button>
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#71717a' }}>Chargement...</div>
      ) : managers.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 60, color: '#52525b', fontSize: 14 }}>Aucun Admin Manager créé</div>
      ) : (
        <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 700 }}>
            <thead><tr style={{ borderBottom: '1px solid #27272a', background: '#09090b' }}>
              {['Nom', 'Email', 'Téléphone', 'Régions', 'Villes', 'Statut', 'Dernière connexion', 'Actions'].map(h => (
                <th key={h} style={{ textAlign: 'left', padding: '10px 14px', fontSize: 11, fontWeight: 600, color: '#71717a', textTransform: 'uppercase' }}>{h}</th>
              ))}
            </tr></thead>
            <tbody>
              {managers.map((m: any) => (
                <tr key={m._id} style={{ borderBottom: '1px solid #27272a' }}>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 600, color: '#fff' }}>{m.firstName?.[0] || 'A'}</div>
                      <div><div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{m.firstName} {m.lastName}</div></div>
                    </div>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{m.email}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{m.phone || '-'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{(m.assignedRegions || []).join(', ') || '-'}</td>
                  <td style={{ padding: '10px 14px', fontSize: 12, color: '#a1a1aa' }}>{(m.assignedCities || []).join(', ') || '-'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: m.isActive ? '#22c55e20' : '#ef444420', color: m.isActive ? '#22c55e' : '#ef4444' }}>{m.isActive ? 'Actif' : 'Inactif'}</span>
                  </td>
                  <td style={{ padding: '10px 14px', fontSize: 11, color: '#52525b' }}>{m.lastLoginAt ? new Date(m.lastLoginAt).toLocaleDateString('fr-FR') : 'Jamais'}</td>
                  <td style={{ padding: '10px 14px' }}>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => openEdit(m)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #27272a', background: 'transparent', color: '#a1a1aa', fontSize: 11, cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => handleDelete(m._id)} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #27272a', background: 'transparent', color: '#ef4444', fontSize: 11, cursor: 'pointer' }}>🗑️</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 200 }} onClick={() => setShowForm(false)}>
          <div style={{ background: '#18181b', borderRadius: 12, padding: 28, width: '90%', maxWidth: 480, border: '1px solid #27272a', maxHeight: '90vh', overflow: 'auto' }} onClick={e => e.stopPropagation()}>
            <h2 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: '0 0 20px' }}>{editId ? 'Modifier' : 'Créer'} un Admin Manager</h2>
            {error && <div style={{ color: '#ef4444', fontSize: 12, marginBottom: 12 }}>{error}</div>}
            <form onSubmit={handleSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                <div><label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Prénom *</label><input value={form.firstName} onChange={e => setForm({ ...form, firstName: e.target.value })} required style={inputStyle} /></div>
                <div><label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Nom *</label><input value={form.lastName} onChange={e => setForm({ ...form, lastName: e.target.value })} required style={inputStyle} /></div>
              </div>
              <div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Email *</label><input type="email" value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} required style={inputStyle} /></div>
              <div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Téléphone</label><input value={form.phone} onChange={e => setForm({ ...form, phone: e.target.value })} style={inputStyle} /></div>
              <div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Mot de passe {editId ? '(laisser vide pour ne pas changer)' : '*'}</label><input type="password" value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} required={!editId} style={inputStyle} /></div>
              <div style={{ marginBottom: 12 }}><label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Régions (séparées par des virgules)</label><input value={form.assignedRegions} onChange={e => setForm({ ...form, assignedRegions: e.target.value })} placeholder="Brazzaville, Pointe-Noire" style={inputStyle} /></div>
              <div style={{ marginBottom: 20 }}><label style={{ fontSize: 11, color: '#a1a1aa', display: 'block', marginBottom: 4 }}>Villes (séparées par des virgules)</label><input value={form.assignedCities} onChange={e => setForm({ ...form, assignedCities: e.target.value })} placeholder="Brazzaville, Pointe-Noire, Dolisie" style={inputStyle} /></div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ flex: 1, padding: '10px', borderRadius: 8, border: '1px solid #27272a', background: 'transparent', color: '#71717a', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
                <button type="submit" style={{ flex: 1, padding: '10px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>{editId ? 'Modifier' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const inputStyle = {
  width: '100%', padding: '10px 12px', background: '#09090b', border: '1px solid #27272a', borderRadius: 6, color: '#fff', fontSize: 13, outline: 'none', boxSizing: 'border-box' as const,
};
