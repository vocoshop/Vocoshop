'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = '/api';

export default function ParametresPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [manager, setManager] = useState<any>({});

  useEffect(() => {
    const token = localStorage.getItem('managerToken');
    if (!token) { router.push('/manager-login'); return; }
    fetch(API + '/admin-manager/auth/profile', {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.ok ? r.json() : Promise.reject()).then(d => {
      setManager(d.user || {});
    }).catch(() => {
      try { setManager(JSON.parse(localStorage.getItem('managerInfo') || '{}')); } catch {}
    }).finally(() => setLoading(false));
  }, []);

  const fullName = `${manager.firstName || ''} ${manager.lastName || ''}`.trim() || manager.name || 'Admin Manager';
  const initial = (manager.firstName?.[0] || manager.name?.[0] || 'A').toUpperCase();
  const lastLogin = manager.lastLoginAt ? new Date(manager.lastLoginAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : null;
  const createdAt = manager.createdAt ? new Date(manager.createdAt).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;

  const Row = ({ label, value, mono }: { label: string; value: string; mono?: boolean }) => (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 20px', borderBottom: '1px solid #1a1a1e', gap: 12 }}>
      <span style={{ fontSize: 12, color: '#71717a', flexShrink: 0 }}>{label}</span>
      <span style={{ fontSize: 12, color: '#fff', textAlign: 'right', wordBreak: 'break-word', fontFamily: mono ? 'monospace' : 'inherit' }}>{value}</span>
    </div>
  );

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 32, height: 32, border: '2px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  return (
    <div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', marginBottom: 20 }}>Paramètres</h1>

      {/* Profile card */}
      <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', overflow: 'hidden', maxWidth: 600, marginBottom: 16 }}>
        <div style={{ padding: '24px 24px 0', display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
          <div style={{ width: 52, height: 52, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 700, color: '#fff', flexShrink: 0 }}>{initial}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 15, fontWeight: 600, color: '#fff' }}>{fullName}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{ fontSize: 11, color: '#71717a' }}>Admin Manager</span>
              <span style={{ width: 4, height: 4, borderRadius: '50%', background: '#52525b' }} />
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: manager.isActive !== false ? '#22c55e' : '#ef4444' }} />
              <span style={{ fontSize: 11, color: manager.isActive !== false ? '#22c55e' : '#ef4444' }}>{manager.isActive !== false ? 'Actif' : 'Inactif'}</span>
            </div>
          </div>
        </div>

        {/* Personal info */}
        <div style={{ borderTop: '1px solid #1a1a1e' }}>
          <div style={{ padding: '8px 20px', fontSize: 10, fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Informations personnelles</div>
          <Row label="Email" value={manager.email || '—'} />
          <Row label="Telephone" value={manager.phone || '—'} />
        </div>

        {/* Account */}
        <div style={{ borderTop: '1px solid #1a1a1e' }}>
          <div style={{ padding: '8px 20px', fontSize: 10, fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Compte</div>
          <Row label="Statut" value={manager.isActive !== false ? 'Actif' : 'Inactif'} />
          {lastLogin && <Row label="Derniere connexion" value={lastLogin} />}
          {createdAt && <Row label="Compte cree le" value={createdAt} />}
        </div>

        {/* Zones */}
        <div style={{ borderTop: '1px solid #1a1a1e' }}>
          <div style={{ padding: '8px 20px', fontSize: 10, fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Zones assignees</div>
          <Row label="Regions" value={Array.isArray(manager.assignedRegions) && manager.assignedRegions.length > 0 ? manager.assignedRegions.join(', ') : 'Aucune'} />
          <Row label="Villes" value={Array.isArray(manager.assignedCities) && manager.assignedCities.length > 0 ? manager.assignedCities.join(', ') : 'Aucune'} />
        </div>
      </div>
    </div>
  );
}
