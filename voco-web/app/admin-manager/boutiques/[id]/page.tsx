'use client';

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function StoreDetailPage() {
  const router = useRouter();
  const params = useParams();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [store, setStore] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [agent, setAgent] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('managerToken');
    if (!token) { router.push('/manager-login'); return; }
    fetch(`${API}/admin-manager/stores/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then(r => r.json()).then(d => {
      setStore(d.store);
      setLogs(d.logs || []);
      setAgent(d.agent);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', color: '#71717a' }}>
      <div style={{ width: 40, height: 40, border: '3px solid #27272a', borderTopColor: '#a855f7', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
    </div>
  );

  if (!store) return <div style={{ color: '#ef4444', padding: 40 }}>Boutique introuvable</div>;

  const fm = (v: number) => `${(v || 0).toLocaleString()} FCFA`;
  const subColor: Record<string, string> = { active: '#22c55e', trial: '#eab308', expired: '#ef4444', pending: '#f97316' };

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      <button onClick={() => router.back()} style={{ background: 'none', border: 'none', color: '#a855f7', cursor: 'pointer', fontSize: 13, marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        ← Retour
      </button>

      <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 20, marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
          <div>
            <h1 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 4px' }}>{store.storeName || store.name || 'Boutique'}</h1>
            <div style={{ color: '#52525b', fontSize: 12 }}>
              {store.city && `${store.city} · `}Créée le {new Date(store.createdAt).toLocaleDateString('fr-FR')}
            </div>
          </div>
          <span style={{ padding: '4px 14px', borderRadius: 20, fontSize: 12, fontWeight: 600, background: `${subColor[store.subscriptionStatus] || '#71717a'}20`, color: subColor[store.subscriptionStatus] || '#71717a' }}>
            {store.subscriptionStatus || 'Inconnu'}
          </span>
        </div>
      </div>

      {/* Agent info + Store Info */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 20 }}>
        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Agent affilié</h3>
          {agent ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 36, height: 36, borderRadius: 10, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600, color: '#fff' }}>{(agent.name || 'A')[0]}</div>
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{agent.name || '—'}</div>
                <div style={{ fontSize: 11, color: '#71717a' }}>{agent.code} · {agent.phone || '—'}</div>
              </div>
            </div>
          ) : <div style={{ color: '#52525b', fontSize: 13 }}>Non assigné</div>}
        </div>

        <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 16 }}>
          <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Abonnement</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div>
              <div style={{ fontSize: 10, color: '#52525b' }}>Plan</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{store.plan || 'Gratuit'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#52525b' }}>Cycles</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{store.billingCycleCount || 0}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#52525b' }}>PaidUntil</div>
              <div style={{ fontSize: 12, color: '#d4d4d8' }}>{store.paidUntil ? new Date(store.paidUntil).toLocaleDateString('fr-FR') : '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: '#52525b' }}>Trial fin</div>
              <div style={{ fontSize: 12, color: '#d4d4d8' }}>{store.trialEnd ? new Date(store.trialEnd).toLocaleDateString('fr-FR') : '—'}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Activity */}
      <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 16, marginBottom: 20 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          Activité ({logs.length} événements)
        </h3>
        {logs.length === 0 ? (
          <div style={{ color: '#52525b', fontSize: 13 }}>Aucune activité</div>
        ) : (
          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            {logs.map((l: any, i: number) => {
              const iconMap: Record<string, string> = { login: '🔑', store_created: '🏪', store_activated: '✅', store_expired: '❌', commission_earned: '💰', password_reset: '🔐' };
              return (
                <div key={l._id || i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '7px 0', borderBottom: '1px solid #0a0a0c' }}>
                  <span>{iconMap[l.type] || '📋'}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: '#d4d4d8' }}>{l.message || l.type}</div>
                    <div style={{ fontSize: 10, color: '#52525b' }}>{l.createdAt ? new Date(l.createdAt).toLocaleString('fr-FR') : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Store info detail */}
      <div style={{ background: '#111113', borderRadius: 12, border: '1px solid #1a1a1e', padding: 16 }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: '#a1a1aa', margin: '0 0 12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Détails techniques</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 20px', fontSize: 13 }}>
          {[
            ['ID', store.shopId || '—'],
            ['Téléphone', store.phone || '—'],
            ['Ville', store.city || '—'],
            ['Agent', store.agentCode || '—'],
            ['Device', store.deviceId || '—'],
            ['Installé le', store.installedAt ? new Date(store.installedAt).toLocaleDateString('fr-FR') : '—'],
            ['Dernière activité', store.lastActiveAt ? new Date(store.lastActiveAt).toLocaleString('fr-FR') : 'Jamais'],
            ['Login count', String(store.loginCount ?? 0)],
            ['Code parrain', store.referralCode || '—'],
            ['Auto-renew', store.autoRenew ? 'Oui' : 'Non'],
          ].map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid #0a0a0c' }}>
              <span style={{ color: '#71717a' }}>{k}</span>
              <span style={{ color: '#d4d4d8', fontWeight: 500, textAlign: 'right' }}>{v}</span>
            </div>
          ))}
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } } @keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
