'use client';

import { useState, useEffect } from 'react';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

const fmt = (n: number) => n.toLocaleString('fr-FR');

const tabs = [
  { id: 'general', label: 'Général' },
  { id: 'plans', label: 'Plans & Prix' },
  { id: 'paiement', label: 'Paiement' },
  { id: 'webhooks', label: 'Webhooks' },
  { id: 'referral', label: 'Parrainage' },
  { id: 'securite', label: 'Sécurité' },
];

function ChangeCredentialsForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email && !password) return;
    setMessage('');
    setError('');
    setSaving(true);
    try {
      const token = localStorage.getItem('adminToken');
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/admin/auth/credentials`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email || undefined, password: password || undefined }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error || 'Erreur'); return; }
      setMessage(data.message + ' — Reconnectez-vous avec vos nouveaux identifiants.');
      setPassword('');
    } catch { setError('Erreur serveur'); }
    finally { setSaving(false); }
  };

  return (
    <form onSubmit={handleSubmit} style={{ background: '#27272a', borderRadius: 10, padding: 20 }}>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: '#a1a1aa', display: 'block', marginBottom: 6 }}>Nouvel email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="superadmin@vocoshop.com" style={{ width: '100%', padding: '10px 14px', background: '#09090b', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ marginBottom: 14 }}>
        <label style={{ fontSize: 12, color: '#a1a1aa', display: 'block', marginBottom: 6 }}>Nouveau mot de passe</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" style={{ width: '100%', padding: '10px 14px', background: '#09090b', border: '1px solid #3f3f46', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none', boxSizing: 'border-box' }} />
      </div>
      {message && <div style={{ color: '#22c55e', fontSize: 13, marginBottom: 12, padding: '8px 12px', background: '#22c55e10', borderRadius: 8 }}>{message}</div>}
      {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
      <button type="submit" disabled={saving || (!email && !password)} style={{ padding: '10px 20px', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', border: 'none', borderRadius: 8, color: '#fff', cursor: (saving || (!email && !password)) ? 'not-allowed' : 'pointer', opacity: (saving || (!email && !password)) ? 0.6 : 1, fontSize: 13, fontWeight: 600 }}>
        {saving ? 'Enregistrement...' : 'Mettre à jour les identifiants'}
      </button>
    </form>
  );
}

function EditModal({ config, onSave, onClose }: { config: any; onSave: (v: any) => void; onClose: () => void }) {
  const [value, setValue] = useState(config?.value ?? '');
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    await onSave(value);
    setSaving(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 16 }} onClick={onClose}>
      <div style={{ background: '#18181b', borderRadius: 16, width: '100%', maxWidth: 440, padding: 24, border: '1px solid #27272a', animation: 'scaleIn 0.2s' }} onClick={e => e.stopPropagation()}>
        <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 4 }}>Modifier {config?.label}</h3>
        {config?.description && <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>{config.description}</p>}
        <form onSubmit={handleSubmit}>
          {config?.type === 'boolean' ? (
            <label style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', cursor: 'pointer' }}>
              <input type="checkbox" checked={value} onChange={e => setValue(e.target.checked)} style={{ width: 20, height: 20, accentColor: '#a855f7' }} />
              <span style={{ fontSize: 13, color: '#a1a1aa' }}>{value ? 'Activé' : 'Désactivé'}</span>
            </label>
          ) : config?.type === 'number' ? (
            <input value={value} onChange={e => setValue(Number(e.target.value))} type="number" style={{ width: '100%', padding: '10px 14px', background: '#09090b', border: '1px solid #27272a', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none' }} />
          ) : (
            <input value={value} onChange={e => setValue(e.target.value)} style={{ width: '100%', padding: '10px 14px', background: '#09090b', border: '1px solid #27272a', borderRadius: 8, color: '#fff', fontSize: 14, outline: 'none' }} />
          )}
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#27272a', border: 'none', color: '#a1a1aa', cursor: 'pointer', fontSize: 13 }}>Annuler</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '10px', borderRadius: 8, background: '#a855f7', border: 'none', color: '#fff', cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.6 : 1, fontSize: 13, fontWeight: 600 }}>{saving ? 'Enregistrement...' : 'Enregistrer'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function ParametresPage() {
  const [tab, setTab] = useState('general');
  const [health, setHealth] = useState<any>(null);
  const [configs, setConfigs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverTime, setServerTime] = useState<any>(null);
  const [editConfig, setEditConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    const t = localStorage.getItem('adminToken');
    if (!t) return;
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${t}` };
      const [sr, cr, wr] = await Promise.all([
        fetch(`${API}/admin/stats`, { headers: h }).catch(() => null),
        fetch(`${API}/admin/config`, { headers: h }).catch(() => null),
        fetch(`${API}/admin/activity-stats?days=1`, { headers: h }).catch(() => null),
      ]);
      if (sr?.ok) setHealth(await sr.json());
      if (cr?.ok) setConfigs((await cr.json()).all || []);
      if (wr?.ok) {
        const wd = await wr.json();
        setServerTime({ date: new Date().toLocaleString('fr-FR'), today: wd.days?.[wd.days.length - 1] });
      }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchData(); }, []);

  const getConfig = (key: string) => configs.find(c => c.key === key);

  const handleSave = async (key: string, value: any) => {
    const t = localStorage.getItem('adminToken');
    if (!t) return;
    setSaving(true);
    try {
      const r = await fetch(`${API}/admin/config`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value }),
      });
      if (r.ok) {
        setConfigs(prev => prev.map(c => c.key === key ? { ...c, value } : c));
        setEditConfig(null);
      }
    } catch {} finally { setSaving(false); }
  };

  const fmtVal = (cfg: any) => {
    if (cfg.type === 'boolean') return cfg.value ? 'Activé' : 'Désactivé';
    if (cfg.type === 'number') return cfg.key.includes('price') || cfg.key.includes('commission') || cfg.key.includes('withdrawal') && !cfg.key.includes('percent')
      ? `${fmt(cfg.value)} XAF` : cfg.key.includes('percent') || cfg.key.includes('fee')
      ? `${cfg.value}%` : cfg.value;
    return String(cfg.value);
  };

  const sub = health?.subscription || {};
  const agents = health?.agents || {};
  const totalStores = health?.stores?.total || 0;
  const monthlyRevenue = (sub.active || 0) * 3900;

  const kpiCard = (label: string, value: string | number, sub?: string, color?: string) => (
    <div style={{ background: '#27272a', borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 20, fontWeight: 700, color: color || '#fff' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>{sub}</div>}
    </div>
  );

  const row = (cfg: any) => (
    <div key={cfg.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 0', borderBottom: '1px solid #27272a' }}>
      <span style={{ fontSize: 13, color: '#a1a1aa' }}>{cfg.label}</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span style={{ fontSize: 13, fontWeight: 500, color: cfg.type === 'boolean' ? (cfg.value ? '#22c55e' : '#ef4444') : '#fff' }}>{fmtVal(cfg)}</span>
        <button onClick={() => setEditConfig(cfg)} style={{ padding: '4px 10px', background: '#a855f710', border: 'none', borderRadius: 6, color: '#a855f7', cursor: 'pointer', fontSize: 11 }}>Modifier</button>
      </div>
    </div>
  );

  const configSection = (categoryId: string) => {
    const section = configs.filter(c => c.category === categoryId);
    return section.map(row);
  };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <h2 style={{ fontSize: 18, fontWeight: 600, color: '#fff', margin: '0 0 4px' }}>⚙️ Paramètres</h2>
      <p style={{ fontSize: 12, color: '#71717a', marginBottom: 20 }}>Configuration et état de la plateforme</p>

      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid #27272a', overflow: 'auto' }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{
            padding: '10px 16px', background: 'transparent', border: 'none', color: tab === t.id ? '#a855f7' : '#71717a',
            cursor: 'pointer', fontSize: 13, fontWeight: tab === t.id ? 600 : 400, whiteSpace: 'nowrap',
            borderBottom: tab === t.id ? '2px solid #a855f7' : '2px solid transparent', marginBottom: -1,
          }}>{t.label}</button>
        ))}
      </div>

      <div style={{ background: '#18181b', borderRadius: 12, padding: 24, border: '1px solid #27272a' }}>
        {tab === 'general' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', margin: 0 }}>Santé système</h3>
              <span style={{ fontSize: 11, color: '#52525b' }}>Mis à jour {serverTime?.date}</span>
            </div>
            {loading ? <div style={{ textAlign: 'center', padding: 40, color: '#71717a' }}>Chargement...</div> : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {kpiCard('Boutiques totales', fmt(totalStores), `${sub.active || 0} actives · ${sub.trial || 0} trial`, '#a855f7')}
                  {kpiCard('Abonnements actifs', fmt(sub.active || 0), `${fmt(monthlyRevenue)} XAF/mois`, '#22c55e')}
                  {kpiCard('Revenus mensuel', `${fmt(monthlyRevenue)} XAF`, `${fmt(monthlyRevenue * 12)} XAF/an`, '#eab308')}
                  {kpiCard('Agents actifs', fmt(agents.active || 0), `${agents.total || 0} inscription(s)`, '#3b82f6')}
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
                  {kpiCard('En grace', fmt(sub.grace || 0), 'Expire bientôt', '#eab308')}
                  {kpiCard('En trial', fmt(sub.trial || 0), 'Période essai', '#eab308')}
                  {kpiCard('Expirés', fmt(sub.expired || 0), 'Non renouvelés', '#ef4444')}
                  {kpiCard('Inactifs', fmt(sub.unused || 0), 'Jamais activés', '#71717a')}
                </div>
                <div style={{ borderTop: '1px solid #27272a', paddingTop: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', marginBottom: 16, textTransform: 'uppercase' }}>État aujourd'hui</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
                    <div style={{ background: '#27272a', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 6 }}>Activités aujourd'hui</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#a855f7' }}>{serverTime?.today?.activity || 0}</div>
                      <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>événement(s)</div>
                    </div>
                    <div style={{ background: '#27272a', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 6 }}>Boutiques créées</div>
                      <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{serverTime?.today?.stores || 0}</div>
                      <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>aujourd'hui</div>
                    </div>
                    <div style={{ background: '#27272a', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 6 }}>Top ville</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa' }}>{(health?.topCities || [])[0]?._id || '-'}</div>
                      <div style={{ fontSize: 11, color: '#52525b', marginTop: 4 }}>{(health?.topCities || [])[0]?.count || 0} boutiques</div>
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: '1px solid #27272a', paddingTop: 20, marginTop: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', marginBottom: 16, textTransform: 'uppercase' }}>Configuration générale</h4>
                  {configSection('general')}
                </div>
                <div style={{ borderTop: '1px solid #27272a', paddingTop: 20, marginTop: 20 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', marginBottom: 16, textTransform: 'uppercase' }}>Info plateforme</h4>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                    <div style={{ background: '#27272a', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Plateforme</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{getConfig('platform_name')?.value || 'VocoShop'}</div>
                    </div>
                    <div style={{ background: '#27272a', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Version</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>1.0.0</div>
                    </div>
                    <div style={{ background: '#27272a', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Serveur API</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#22c55e' }}>En ligne</span>
                      </div>
                    </div>
                    <div style={{ background: '#27272a', borderRadius: 10, padding: 16 }}>
                      <div style={{ fontSize: 11, color: '#71717a', marginBottom: 4 }}>Fuseau horaire</div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{getConfig('timezone')?.value || 'Africa/Douala'}</div>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {tab === 'plans' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 20 }}>Plans d'abonnement</h3>
            {[
              { name: 'Essai gratuit', price: getConfig('trial_days') ? `0 XAF · ${getConfig('trial_days')?.value} jours` : '0 XAF · 30 jours', features: 'Fonctionnalités de base', status: 'Actif' },
              { name: 'Mensuel', price: `${fmt(getConfig('monthly_price')?.value || 3900)} XAF · 30 jours`, features: 'Tout accès', status: 'Actif' },
              { name: 'Annuel', price: `${fmt(getConfig('annual_price')?.value || 39000)} XAF · 365 jours`, features: 'Tout accès · 2 mois offerts', status: (getConfig('annual_price')?.value || 39000) > 0 ? 'Actif' : 'Inactif' },
            ].map(p => (
              <div key={p.name} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px', background: '#27272a', borderRadius: 8, marginBottom: 10 }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{p.name}</div>
                  <div style={{ fontSize: 12, color: '#71717a' }}>{p.price}</div>
                </div>
                <span style={{ padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 500, background: p.status === 'Actif' ? '#22c55e20' : '#ef444420', color: p.status === 'Actif' ? '#22c55e' : '#ef4444' }}>{p.status}</span>
              </div>
            ))}
            <div style={{ marginTop: 24, borderTop: '1px solid #27272a', paddingTop: 20 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', marginBottom: 16, textTransform: 'uppercase' }}>Paramètres tarification</h4>
              {configSection('pricing')}
            </div>
          </div>
        )}

        {tab === 'paiement' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 20 }}>Configuration paiement</h3>
            {configSection('payment')}
          </div>
        )}

        {tab === 'webhooks' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 20 }}>Webhooks</h3>
            {configSection('webhooks')}
          </div>
        )}

        {tab === 'referral' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 20 }}>Paramètres parrainage</h3>
            {configSection('referral')}
          </div>
        )}

        {tab === 'securite' && (
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 600, color: '#fff', marginBottom: 20 }}>Sécurité</h3>
            {configSection('security')}

            <div style={{ borderTop: '1px solid #27272a', paddingTop: 24, marginTop: 24 }}>
              <h4 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', marginBottom: 16, textTransform: 'uppercase' }}>Identifiants Super Admin</h4>
              <ChangeCredentialsForm />
            </div>
          </div>
        )}
      </div>

      {editConfig && (
        <EditModal
          config={editConfig}
          onClose={() => setEditConfig(null)}
          onSave={(value) => handleSave(editConfig.key, value)}
        />
      )}
    </div>
  );
}
