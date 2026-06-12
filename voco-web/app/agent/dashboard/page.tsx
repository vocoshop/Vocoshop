'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL || '/api';

type Tab = 'dashboard' | 'boutiques' | 'commissions' | 'activites' | 'objectifs' | 'profil';

interface Agent { id: string; code: string; firstName: string; lastName: string; phone: string; country: string; city: string; region: string; gender: string; birthDate?: string; idType: string; idNumber: string; isApproved: boolean; isActive: boolean; mustChangePassword: boolean; lastLoginAt?: string; createdAt?: string; }
interface Store { id: string; storeName: string; ownerName: string; phone: string; subscriptionStatus: string; lastActiveAt: string; createdAt: string; }
interface Commission { id: string; amount: number; type: string; status: string; storeName: string; createdAt: string; }

const sc = (s?: string) => ({
  active:    { c: '#22c55e', b: '#22c55e18', l: 'Actif' },
  trial:     { c: '#eab308', b: '#eab30818', l: 'Essai gratuit' },
  expired:   { c: '#ef4444', b: '#ef444418', l: 'Expiré' },
  suspended: { c: '#6b7280', b: '#6b728018', l: 'Suspendu' },
  paid:      { c: '#22c55e', b: '#22c55e18', l: 'Payé' },
  pending:   { c: '#eab308', b: '#eab30818', l: 'En attente' },
  rejected:  { c: '#ef4444', b: '#ef444418', l: 'Rejeté' },
  none:      { c: '#6b7280', b: '#6b728008', l: '—' },
}[String(s)] || { c: '#eab308', b: '#eab30818', l: 'En attente' });

export default function AgentDashboard() {
  const [agent, setAgent] = useState<Agent | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [commissions, setCommissions] = useState<Commission[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('dashboard');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('all');
  const [selected, setSelected] = useState<Store | null>(null);
  const [showStore, setShowStore] = useState(false);
  const [wdAmount, setWdAmount] = useState('');
  const [wdPhone, setWdPhone] = useState('');
  const [wdLoading, setWdLoading] = useState(false);
  const [wdError, setWdError] = useState('');
  const [wdSuccess, setWdSuccess] = useState('');
  const [showConfirm, setShowConfirm] = useState(false);
  const [balance, setBalance] = useState(0);
  const [withdrawals, setWithdrawals] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  const [activityFilter, setActivityFilter] = useState<string | null>(null);
  const [mobileMenu, setMobileMenu] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const router = useRouter();

  useEffect(() => {
    const saved = localStorage.getItem('agentTheme');
    if (saved === 'light' || saved === 'dark') setTheme(saved);
  }, []);

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    localStorage.setItem('agentTheme', next);
  };

  // Dimensions
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    h(); window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  const isMobile = width < 768;
  const isTablet = width >= 768 && width < 1024;

  useEffect(() => {
    const t = localStorage.getItem('agentToken');
    if (!t) { router.push('/login'); return; }
    (async () => {
      try {
        const h = { Authorization: `Bearer ${t}` };
        const [sr, cr, mr, br, wr, ar] = await Promise.all([
          fetch(`${API}/agent/stores`, { headers: h }).catch(() => ({ ok: false, json: () => ({ stores: [] }) })),
          fetch(`${API}/agent/commissions`, { headers: h }).catch(() => ({ ok: false, json: () => ({ commissions: [] }) })),
          fetch(`${API}/agent/me`, { headers: h }).catch(() => ({ ok: false, json: () => ({}) })),
          fetch(`${API}/agent/withdrawals/balance`, { headers: h }).catch(() => ({ ok: false, json: () => ({ balance: 0 }) })),
          fetch(`${API}/agent/withdrawals`, { headers: h }).catch(() => ({ ok: false, json: () => ({ withdrawals: [] }) })),
          fetch(`${API}/agent/activity`, { headers: h }).catch(() => ({ ok: false, json: () => ({ activities: [] }) })),
        ]);
        if ([sr, cr, mr, br, wr, ar].some((r: any) => r?.status === 401)) {
          localStorage.removeItem('agentToken'); localStorage.removeItem('agentInfo');
          router.push('/login'); return;
        }
        if (sr.ok) setStores((await sr.json()).stores || []);
        if (cr.ok) setCommissions((await cr.json()).commissions || []);
        if (mr.ok) {
          const me = (await mr.json()) as any;
          if (me?.agent) { setAgent(me.agent); localStorage.setItem('agentInfo', JSON.stringify(me.agent)); }
        }
        if (br.ok) setBalance((await br.json()).balance || 0);
        if (wr.ok) setWithdrawals((await wr.json()).withdrawals || []);
        if (ar.ok) setActivities((await ar.json()).activities || []);
        const a = localStorage.getItem('agentInfo');
        if (a) { try { setAgent(JSON.parse(a)); } catch {} }
      } catch (_) {} finally { setLoading(false); }
    })();
    setTimeout(() => setLoading(false), 12000);
  }, []);

  // Stats
  const totalStores = stores.length;
  const activeSubs = stores.filter(s => s.subscriptionStatus === 'active').length;
  const totalComm = commissions.reduce((s, c) => s + (c.amount || 0), 0);
  const monthComm = commissions.filter(c => {
    const d = new Date(c.createdAt), n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).reduce((s, c) => s + (c.amount || 0), 0);
  const pendingComm = commissions.filter(c => c.status === 'pending').reduce((s, c) => s + (c.amount || 0), 0);
  const newThisMonth = stores.filter(s => {
    const d = new Date(s.createdAt), n = new Date();
    return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear();
  }).length;
  const goal = 100; // objectif : boutiques payantes
  const convRate = totalStores ? Math.round(activeSubs / totalStores * 100) : 0;
  const fmt = (n: number) => n.toLocaleString() + ' FCFA';

  // Activity stats
  const now = Date.now();
  const todayStr = new Date().toDateString();
  const daysSince = (d: string) => d ? Math.floor((now - new Date(d).getTime()) / 86400000) : 999;
  const activeToday = stores.filter(s => s.lastActiveAt && new Date(s.lastActiveAt).toDateString() === todayStr).length;
  const notToday = stores.filter(s => s.lastActiveAt && new Date(s.lastActiveAt).toDateString() !== todayStr).length;
  const inactive1w = stores.filter(s => daysSince(s.lastActiveAt) >= 7).length;
  const inactive2w = stores.filter(s => daysSince(s.lastActiveAt) >= 14).length;
  const inactive1m = stores.filter(s => daysSince(s.lastActiveAt) >= 30).length;

  const getFilteredStores = (filter: string) => {
    switch (filter) {
      case 'activeToday': return stores.filter(s => s.lastActiveAt && new Date(s.lastActiveAt).toDateString() === todayStr);
      case 'notToday': return stores.filter(s => s.lastActiveAt && new Date(s.lastActiveAt).toDateString() !== todayStr);
      case 'inactive1w': return stores.filter(s => daysSince(s.lastActiveAt) >= 7);
      case 'inactive2w': return stores.filter(s => daysSince(s.lastActiveAt) >= 14);
      case 'inactive1m': return stores.filter(s => daysSince(s.lastActiveAt) >= 30);
      case 'never': return stores.filter(s => !s.lastActiveAt);
      case 'paid': return stores.filter(s => s.subscriptionStatus === 'active');
      case 'trial': return stores.filter(s => s.subscriptionStatus === 'trial');
      case 'expired': return stores.filter(s => s.subscriptionStatus === 'expired');
      case 'pending': return stores.filter(s => !s.subscriptionStatus || s.subscriptionStatus === 'pending');
      default: return [];
    }
  };

  // Weekly install data (simulated from real data)
  const weeklyData = (() => {
    const now = new Date();
    const weeks: { label: string; count: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const w = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i * 7);
      const label = w.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
      const count = stores.filter(s => {
        const d = new Date(s.createdAt);
        return d >= w && d < new Date(w.getTime() + 7 * 86400000);
      }).length;
      weeks.push({ label, count });
    }
    return weeks;
  })();

  // Monthly commission data
  const monthlyData = (() => {
    const months: { label: string; amount: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const label = d.toLocaleDateString('fr-FR', { month: 'short' });
      const amount = commissions.filter(c => {
        const cd = new Date(c.createdAt);
        return cd.getMonth() === d.getMonth() && cd.getFullYear() === d.getFullYear();
      }).reduce((s, c) => s + (c.amount || 0), 0);
      months.push({ label, amount });
    }
    return months;
  })();

  const maxWeekly = Math.max(...weeklyData.map(w => w.count), 1);
  const maxMonthly = Math.max(...monthlyData.map(m => m.amount), 1);

  const filteredStores = stores.filter(s => {
    const q = search.toLowerCase();
    const match = s.storeName.toLowerCase().includes(q) || s.ownerName.toLowerCase().includes(q) || s.phone.includes(q);
    return match && (filter === 'all' || s.subscriptionStatus === filter || (filter === 'pending' && !s.subscriptionStatus));
  });

  if (loading) return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-page)' }}>
      <div style={{ width: 32, height: 32, border: '2px solid var(--border)', borderTopColor: '#a855f7', borderRadius: '50%' }} />
      <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 16 }}>Chargement de votre espace…</p>
    </div>
  );

  const SIDEBAR = (
    <aside style={{
      width: isMobile ? '100%' : 240, height: isMobile ? 'auto' : '100vh',
      position: isMobile ? 'relative' : 'fixed', background: 'var(--bg-hover)',
      borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column',
      padding: '20px 16px', zIndex: 100, transition: 'all 0.3s ease',
    }}>
      {/* Logo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 28, padding: '0 8px' }}>
        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#a855f7,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>V</div>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>Vocoshop</div>
          <div style={{ fontSize: 11, color: '#a855f7' }}>Agent Dashboard</div>
        </div>
      </div>

      {/* Solde */}
      <div style={{ padding: '12px 14px', background: 'linear-gradient(135deg,#22c55e10,#22c55e05)', borderRadius: 10, border: '1px solid #22c55e20', marginBottom: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>Solde disponible</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#22c55e' }}>{fmt(balance)}</div>
      </div>

      {/* Nav */}
      <nav style={{ display: 'flex', flexDirection: 'column', gap: 2, flex: 1 }}>
        {[
          { id: 'dashboard', icon: 'grid', label: 'Dashboard' },
          { id: 'boutiques', icon: 'store', label: 'Mes boutiques', count: totalStores },
          { id: 'commissions', icon: 'wallet', label: 'Commissions' },
          { id: 'activites', icon: 'activity', label: 'Activités' },
          { id: 'objectifs', icon: 'target', label: 'Objectifs' },
          { id: 'profil', icon: 'user', label: 'Mon profil' },
        ].map(n => (
          <button key={n.id} onClick={() => { setTab(n.id as Tab); setMobileMenu(false); }}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, border: 'none', cursor: 'pointer', fontSize: 13, textAlign: 'left',
              color: tab === n.id ? 'var(--text-primary)' : 'var(--text-muted)',
              background: tab === n.id ? '#a855f715' : 'transparent',
              transition: 'all 0.2s ease',
            }}>
            <Icon name={n.icon} />
            <span style={{ flex: 1 }}>{n.label}</span>
            {(n as any).count !== undefined && (
              <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 20, background: '#a855f720', color: '#a855f7', fontWeight: 600 }}>{(n as any).count}</span>
            )}
          </button>
        ))}
      </nav>

      <button onClick={() => { localStorage.removeItem('agentToken'); localStorage.removeItem('agentInfo'); router.push('/login'); }}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#ef444408', border: 'none', borderRadius: 10, color: '#ef4444', cursor: 'pointer', fontSize: 13, marginTop: 8 }}>
        <Icon name="logout" /> Déconnexion
      </button>
      <button onClick={toggleTheme}
        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 12, marginTop: 6 }}>
        {theme === 'dark' ? '☀️' : '🌙'} {theme === 'dark' ? 'Mode clair' : 'Mode sombre'}
      </button>
    </aside>
  );

  return (
    <div data-theme={theme} style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
      <style>{`
        :root {
          --bg-page: #09090b;
          --bg-card: #18181b;
          --bg-hover: #0c0c0e;
          --bg-row-hover: #141416;
          --bg-input: #0c0c0e;
          --bg-progress: #27272a;
          --border: #27272a;
          --text-primary: #ffffff;
          --text-secondary: #e4e4e7;
          --text-muted: #52525b;
          --text-dim: #3f3f46;
        }
        [data-theme="light"] {
          --bg-page: #f4f4f5;
          --bg-card: #ffffff;
          --bg-hover: #f4f4f5;
          --bg-row-hover: #e8e8ea;
          --bg-input: #ffffff;
          --bg-progress: #e4e4e7;
          --border: #e4e4e7;
          --text-primary: #18181b;
          --text-secondary: #27272a;
          --text-muted: #71717a;
          --text-dim: #a1a1aa;
        }
        @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideRight { from { opacity: 0; transform: translateX(-12px); } to { opacity: 1; transform: translateX(0); } }
        @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.5; } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.96); } to { opacity: 1; transform: scale(1); } }
        @keyframes barGrow { from { transform: scaleX(0); } to { transform: scaleX(1); } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 20px rgba(168,85,247,0.1); } 50% { box-shadow: 0 0 40px rgba(168,85,247,0.2); } }
        .tab-content { animation: fadeUp 0.4s ease-out; }
        .stat-card { animation: fadeUp 0.4s ease-out both; }
        .stat-card:nth-child(1) { animation-delay: 0.05s; }
        .stat-card:nth-child(2) { animation-delay: 0.1s; }
        .stat-card:nth-child(3) { animation-delay: 0.15s; }
        .stat-card:nth-child(4) { animation-delay: 0.2s; }
        .list-row { animation: fadeUp 0.3s ease-out both; transition: all 0.15s ease; }
        .list-row:hover { border-color: var(--text-dim) !important; background: var(--bg-row-hover) !important; }
        .list-row:nth-child(1) { animation-delay: 0.05s; }
        .list-row:nth-child(2) { animation-delay: 0.08s; }
        .list-row:nth-child(3) { animation-delay: 0.11s; }
        .list-row:nth-child(4) { animation-delay: 0.14s; }
        .list-row:nth-child(5) { animation-delay: 0.17s; }
        .sidebar-item { animation: slideRight 0.3s ease-out both; }
        .sidebar-item:nth-child(1) { animation-delay: 0.03s; }
        .sidebar-item:nth-child(2) { animation-delay: 0.06s; }
        .sidebar-item:nth-child(3) { animation-delay: 0.09s; }
        .sidebar-item:nth-child(4) { animation-delay: 0.12s; }
        .sidebar-item:nth-child(5) { animation-delay: 0.15s; }
        .sidebar-item:nth-child(6) { animation-delay: 0.18s; }
        .hover-lift { transition: all 0.2s ease; }
        .hover-lift:hover { transform: translateY(-2px); }
        .bar-fill { animation: barGrow 0.6s ease-out 0.3s both; transform-origin: left; }
        .chart-col { transition: all 0.3s ease; }
        .chart-col:hover { opacity: 0.8; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--bg-progress); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: #3f3f46; }
        input:focus, select:focus { outline: none; border-color: #a855f7 !important; box-shadow: 0 0 0 2px rgba(168,85,247,0.15); }
      `}</style>

      {/* Desktop Sidebar */}
      {!isMobile && SIDEBAR}

      {/* Mobile: Top bar + bottom nav */}
      {isMobile && (
        <>
          <header style={{ position: 'fixed', top: 0, left: 0, right: 0, height: 60, background: 'var(--bg-hover)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 16px', zIndex: 200 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button onClick={() => setMobileMenu(!mobileMenu)} style={{ background: 'none', border: 'none', color: 'var(--text-primary)', fontSize: 20, cursor: 'pointer' }}>☰</button>
              <button onClick={toggleTheme} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 16, cursor: 'pointer' }}>{theme === 'dark' ? '☀️' : '🌙'}</button>
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Vocoshop</div>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg,#a855f7,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
              {(agent?.firstName?.[0] || 'A').toUpperCase()}
            </div>
          </header>
          {mobileMenu && <div style={{ position: 'fixed', top: 60, left: 0, right: 0, bottom: 0, background: 'var(--bg-hover)', zIndex: 199, overflow: 'auto', padding: 16 }}>{SIDEBAR}</div>}
        </>
      )}

      {/* Main */}
      <main style={{ flex: 1, marginLeft: isMobile ? 0 : 240, marginTop: isMobile ? 60 : 0, padding: isMobile ? 16 : '28px 40px', overflow: 'auto' }}>

        {/* ─── DASHBOARD ─── */}
        {tab === 'dashboard' && (
          <div className="tab-content">
            {/* Welcome */}
            <div style={{
              padding: isMobile ? 24 : 32, borderRadius: 16, marginBottom: 28,
              background: theme === 'dark'
                ? 'linear-gradient(135deg,#1a1a2e 0%,#16213e 50%,#0f3460 100%)'
                : 'linear-gradient(135deg,#e0e7ff 0%,#dbeafe 50%,#ede9fe 100%)',
              border: '1px solid rgba(168,85,247,0.2)',
              position: 'relative', overflow: 'hidden',
            }}>
              <div style={{ position: 'absolute', top: '-50%', right: '-20%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(168,85,247,0.08),transparent)', pointerEvents: 'none' }} />
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: isMobile ? 'flex-start' : 'center', flexDirection: isMobile ? 'column' : 'row', gap: 16 }}>
                <div>
                  <h2 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, color: 'var(--text-primary)', margin: 0, letterSpacing: '-0.5px' }}>Bonjour {agent?.firstName || 'Agent'} 👋</h2>
                  <p style={{ fontSize: 14, color: 'var(--text-muted)', margin: '8px 0 0', maxWidth: 400 }}>Voici vos performances commerciales aujourd'hui.</p>
                </div>
                <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Taux conversion</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#22c55e' }}>{convRate}%</div>
                  </div>
                  <div style={{ width: 1, height: 40, background: 'rgba(255,255,255,0.1)' }} />
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Nouvelles ce mois</div>
                    <div style={{ fontSize: 22, fontWeight: 700, color: '#a855f7' }}>+{newThisMonth}</div>
                  </div>
                </div>
              </div>
            </div>

            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : isTablet ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 28 }}>
              {[
                { label: 'Boutiques installées', value: String(totalStores), sub: `+${newThisMonth} ce mois`, icon: '🏪', color: 'var(--text-primary)' },
                { label: 'Boutiques actives', value: String(activeSubs), sub: `${convRate}% de conversion`, icon: '✅', color: '#22c55e' },
                { label: 'Commissions gagnées', value: fmt(totalComm), sub: `800 FCFA/abonnement · ${fmt(monthComm)} ce mois`, icon: '💰', color: '#a855f7' },
                { label: 'Objectif du mois', value: `${activeSubs} / ${goal}`, sub: 'Boutiques payantes', icon: '🎯', color: '#eab308' },
              ].map((k, i) => (
                <div key={i} className="stat-card hover-lift" style={{
                  padding: 20, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', cursor: 'default',
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.5px' }}>{k.label}</span>
                    <span style={{ fontSize: 20 }}>{k.icon}</span>
                  </div>
                  <div style={{ fontSize: isMobile ? 22 : 28, fontWeight: 700, color: k.color, letterSpacing: '-0.5px' }}>{k.value}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{k.sub}</div>
                  {i === 3 && (
                    <div style={{ marginTop: 12, height: 4, background: 'var(--bg-progress)', borderRadius: 2, overflow: 'hidden' }}>
                      <div className="bar-fill" style={{ width: `${Math.min((activeSubs / goal) * 100, 100)}%`, height: '100%', background: 'linear-gradient(90deg,#eab308,#f59e0b)', borderRadius: 2 }} />
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Historique des retraits */}
            {withdrawals.length > 0 && (
              <>
                <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '24px 0 12px' }}>Historique des retraits</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {withdrawals.map((w, i) => {
                    const st = sc(w.status);
                    return (
                      <div key={i} className="list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>Retrait de {fmt(w.amount)}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>{w.phone} · {new Date(w.createdAt).toLocaleDateString('fr-FR')}</div>
                          {w.adminNote && <div style={{ fontSize: 11, color: '#ef4444', marginTop: 2 }}>Motif : {w.adminNote}</div>}
                        </div>
                        <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: st.b, color: st.c }}>{st.l}</span>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        )}

      {/* ─── BOUTIQUES ─── */}
        {tab === 'boutiques' && (
          <div className="tab-content">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Mes boutiques</h2>
                <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>{totalStores} boutique{totalStores > 1 ? 's' : ''} affiliée{totalStores > 1 ? 's' : ''} à votre code</p>
              </div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Rechercher…"
                  style={{ padding: '9px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', width: 160 }} />
                <select value={filter} onChange={e => setFilter(e.target.value)}
                  style={{ padding: '9px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none' }}>
                  <option value="all">Toutes</option>
                  <option value="active">Actives</option>
                  <option value="trial">Essai gratuit</option>
                  <option value="expired">Expirées</option>
                </select>
              </div>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Nom', 'Propriétaire', 'Téléphone', 'Statut', 'Installation', 'Dernière activité', ''].map(h => (
                      <th key={h} style={{ textAlign: 'left', padding: '12px 14px', color: 'var(--text-muted)', fontWeight: 500, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredStores.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 13 }}>Aucune boutique trouvée</td></tr>
                  ) : (
                    filteredStores.map(s => {
                      const st = sc(s.subscriptionStatus);
                      const lastActive = s.lastActiveAt ? Math.floor((Date.now() - new Date(s.lastActiveAt).getTime()) / 86400000) : null;
                      return (
                        <tr key={s.id} className="list-row" style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '12px 14px', color: 'var(--text-primary)', fontWeight: 500, whiteSpace: 'nowrap' }}>{s.storeName}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-muted)' }}>{s.ownerName || '—'}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.phone}</td>
                          <td style={{ padding: '12px 14px' }}><span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: st.b, color: st.c }}>{st.l}</span></td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString('fr-FR') : '—'}</td>
                          <td style={{ padding: '12px 14px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>{lastActive !== null ? (lastActive === 0 ? "Aujourd'hui" : `Il y a ${lastActive}j`) : 'Jamais'}</td>
                          <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}>
                            <div style={{ display: 'flex', gap: 4 }}>
                              <button onClick={() => { setSelected(s); setShowStore(true); }} style={{ padding: '4px 8px', background: '#a855f710', border: 'none', borderRadius: 6, color: '#a855f7', cursor: 'pointer', fontSize: 11 }}>Voir</button>
                              <a href={`tel:${s.phone}`} style={{ padding: '4px 8px', background: '#22c55e10', border: 'none', borderRadius: 6, color: '#22c55e', cursor: 'pointer', fontSize: 11, textDecoration: 'none' }}>Appeler</a>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── COMMISSIONS ─── */}
        {tab === 'commissions' && (
          <div className="tab-content">
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Mes commissions</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>800 FCFA par boutique payante/mois (après 1 mois d'essai gratuit)</p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
              {[
                { label: 'Total gagné', value: fmt(totalComm), color: 'var(--text-primary)' },
                { label: 'Ce mois', value: fmt(monthComm), color: '#22c55e' },
                { label: 'En attente', value: fmt(pendingComm), color: '#eab308' },
                { label: 'Retiré', value: fmt(commissions.filter(c => c.status === 'paid').reduce((s, c) => s + c.amount, 0) - balance > 0 ? 0 : 0), color: '#a855f7' },
              ].map((k, i) => (
                <div key={i} className="stat-card" style={{ padding: 18, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>{k.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            <div style={{ padding: 20, background: 'var(--bg-card)', borderRadius: 12, border: '1px solid var(--border)', marginBottom: 24 }}>
              <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 16px' }}>Demander un retrait</h3>
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Montant</label>
                  <input type="number" value={wdAmount} onChange={e => setWdAmount(e.target.value)} placeholder="Ex: 50000"
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <div style={{ flex: 1, minWidth: 140 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Téléphone</label>
                  <input type="tel" value={wdPhone} onChange={e => setWdPhone(e.target.value)} placeholder="+242 XX XXX XX XX"
                    style={{ width: '100%', padding: '9px 12px', background: 'var(--bg-hover)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-primary)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                </div>
                <button onClick={() => {
                  const amt = Number(wdAmount);
                  if (!amt || amt < 1000) { setWdError('Min 1 000 FCFA'); return; }
                  if (amt > balance) { setWdError('Solde insuffisant'); return; }
                  if (!wdPhone) { setWdError('Numéro requis'); return; }
                  setShowConfirm(true);
                }} disabled={wdLoading}
                  style={{ padding: '10px 20px', background: '#a855f7', border: 'none', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, opacity: wdLoading ? 0.6 : 1 }}>
                  {wdLoading ? 'Traitement…' : 'Effectuer le retrait'}
                </button>
              </div>
              {wdError && <div style={{ fontSize: 12, color: '#ef4444', marginTop: 12 }}>{wdError}</div>}
              {wdSuccess && <div style={{ fontSize: 12, color: '#22c55e', marginTop: 12 }}>{wdSuccess}</div>}

              {/* Confirmation */}
              {showConfirm && (
                <div style={{ marginTop: 16, padding: 16, background: 'var(--bg-hover)', borderRadius: 10, border: '1px solid #a855f730' }}>
                  <div style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 12 }}>Confirmer le retrait</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#a855f7', marginBottom: 8 }}>{fmt(Number(wdAmount))} FCFA</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 16 }}>Vers <strong>{wdPhone}</strong></div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button onClick={async () => {
                      const amt = Number(wdAmount);
                      setWdLoading(true); setWdError(''); setWdSuccess('');
                      try {
                        const res = await fetch(`${API}/agent/withdrawals`, {
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('agentToken')}` },
                          body: JSON.stringify({ amount: amt, phone: wdPhone }),
                        });
                        const data = await res.json();
                        if (!res.ok) { setWdError(data.error || 'Erreur'); setWdLoading(false); return; }
                        setWdSuccess(`✓ Retrait de ${fmt(amt)} effectué !`);
                        setWdAmount(''); setWdPhone(''); setWdLoading(false); setShowConfirm(false);
                        setBalance(prev => prev - amt);
                        setWithdrawals(prev => [{ ...data.withdrawal, status: data.withdrawal.status }, ...prev]);
                      } catch { setWdError('Erreur de connexion'); setWdLoading(false); }
                    }} disabled={wdLoading}
                      style={{ flex: 1, padding: '10px', background: '#22c55e', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      {wdLoading ? 'Traitement…' : '✓ Confirmer'}
                    </button>
                    <button onClick={() => { setShowConfirm(false); setWdError(''); }}
                      style={{ flex: 1, padding: '10px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8, color: 'var(--text-secondary)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>
                      ✕ Annuler
                    </button>
                  </div>
                </div>
              )}
            </div>

            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>Historique des commissions</h3>
            {commissions.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>💸 Aucune commission pour le moment</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {commissions.map((c, i) => {
                  const st = sc(c.status);
                  return (
                    <div key={i} className="list-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 14px', background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{c.storeName}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 1 }}>Commission · {new Date(c.createdAt).toLocaleDateString('fr-FR')}</div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: c.status === 'paid' ? '#22c55e' : '#eab308' }}>+{fmt(c.amount)}</div>
                        <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: st.b, color: st.c, marginTop: 2, display: 'inline-block' }}>{st.l}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ─── ACTIVITÉS ─── */}
        {tab === 'activites' && (
          <div className="tab-content">
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Activités</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>Contrôle complet de vos boutiques</p>

            {/* ─── STATS ACTIVITÉ ─── */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { key: 'activeToday', label: '🟢 Actives aujourd\'hui', value: activeToday, sub: `sur ${totalStores}`, color: '#22c55e' },
                { key: 'notToday', label: '⚪ Pas ouvert aujourd\'hui', value: notToday, sub: "n'ont pas lancé l'app", color: 'var(--text-secondary)' },
                { key: 'inactive1w', label: '🟡 Inactives 1 semaine', value: inactive1w, sub: `dont ${inactive2w} depuis 2 sem.`, color: '#eab308' },
                { key: 'inactive1m', label: '🔴 Inactives 1 mois+', value: inactive1m, sub: '⚠️ risque de désabonnement', color: '#ef4444' },
              ].map((k, i) => (
                <div key={i} onClick={() => setActivityFilter(k.key)} style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-dim)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: k.color }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>

            {/* Barres activité */}
            <div style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', marginBottom: 20 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 12 }}>Répartition activité</div>
              {[
                { key: 'activeToday', label: 'Aujourd\'hui', count: activeToday, color: '#22c55e' },
                { key: null, label: 'Cette semaine (< 7j)', count: stores.filter(s => { const d = daysSince(s.lastActiveAt); return d > 0 && d < 7; }).length, color: '#a855f7' },
                { key: null, label: '1-2 semaines', count: stores.filter(s => { const d = daysSince(s.lastActiveAt); return d >= 7 && d < 14; }).length, color: '#eab308' },
                { key: null, label: '2-4 semaines', count: stores.filter(s => { const d = daysSince(s.lastActiveAt); return d >= 14 && d < 30; }).length, color: '#f97316' },
                { key: 'inactive1m', label: '1 mois+', count: inactive1m, color: '#ef4444' },
                { key: 'never', label: 'Jamais connectée', count: stores.filter(s => !s.lastActiveAt).length, color: '#6b7280' },
              ].map((b, i) => totalStores > 0 && (
                <div key={i} onClick={() => b.key && setActivityFilter(b.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, cursor: b.key ? 'pointer' : 'default' }}>
                  <div style={{ width: 130, fontSize: 11, color: 'var(--text-muted)', textAlign: 'right', flexShrink: 0 }}>{b.label}</div>
                  <div style={{ flex: 1, height: 18, background: 'var(--bg-progress)', borderRadius: 4, overflow: 'hidden', position: 'relative' }}>
                    <div style={{ width: `${(b.count / totalStores) * 100}%`, height: '100%', background: b.color, borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ width: 30, fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', textAlign: 'right' }}>{b.count}</div>
                </div>
              ))}
            </div>

            {/* Abonnements */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4,1fr)', gap: 10, marginBottom: 20 }}>
              {[
                { key: 'paid', label: '✅ Payantes', value: activeSubs, color: '#22c55e' },
                { key: 'trial', label: '🎁 Essai gratuit', value: stores.filter(s => s.subscriptionStatus === 'trial').length, color: '#a855f7' },
                { key: 'expired', label: '⚠️ Expirées', value: stores.filter(s => s.subscriptionStatus === 'expired').length, color: '#ef4444' },
                { key: 'pending', label: '⏳ En attente', value: stores.filter(s => !s.subscriptionStatus || s.subscriptionStatus === 'pending').length, color: '#eab308' },
              ].map((k, i) => (
                <div key={i} onClick={() => setActivityFilter(k.key)} style={{ padding: 14, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', cursor: 'pointer', transition: 'all 0.15s ease' }}
                  onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--text-dim)')}
                  onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, color: k.color }}>{k.value}</div>
                </div>
              ))}
            </div>

            {/* ─── JOURNAL D'ACTIVITÉ ─── */}
            <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>📋 Journal d'activité</h3>

            {activities.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)', fontSize: 13 }}>
                <span style={{ fontSize: 24, display: 'block', marginBottom: 8 }}>⚡</span>Aucune activité pour le moment
              </div>
            ) : (
              (() => {
                const t = new Date();
                const ts = t.toLocaleDateString('fr-FR');
                const y = new Date(t);
                y.setDate(y.getDate() - 1);
                const ys = y.toLocaleDateString('fr-FR');
                const grp: { label: string; items: any[] }[] = [];
                activities.forEach((a: any) => {
                  const d = new Date(a.time);
                  const ds = d.toLocaleDateString('fr-FR');
                  const lb = ds === ts ? 'Aujourd\'hui' : ds === ys ? 'Hier' : ds;
                  const ex = grp.find(x => x.label === lb);
                  if (ex) ex.items.push(a);
                  else grp.push({ label: lb, items: [a] });
                });
                return grp.map((s, si) => (
                  <div key={si} style={{ marginBottom: 24 }}>
                    <h4 style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' }}>
                      {s.label === 'Aujourd\'hui' ? '📅 Aujourd\'hui' : s.label === 'Hier' ? '⬅️ Hier' : `📆 ${s.label}`}
                    </h4>
                    <div style={{ position: 'relative', paddingLeft: 20 }}>
                      <div style={{ position: 'absolute', left: 8, top: 8, bottom: 8, width: 2, background: 'var(--bg-progress)', borderRadius: 1 }} />
                      {s.items.map((a: any, i: number) => (
                        <div key={a.id || i} style={{ position: 'relative', paddingLeft: 28, paddingBottom: 14, animation: `fadeUp 0.3s ease-out ${i * 0.03}s both` }}>
                          <div style={{ position: 'absolute', left: -20, top: 4, width: 14, height: 14, borderRadius: '50%', background: 'var(--bg-hover)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 7 }}>{a.icon}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>{a.message}</div>
                          <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 1 }}>
                            {new Date(a.time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ));
              })()
            )}

            {/* ─── MODAL LISTE BOUTIQUES ─── */}
            {activityFilter && (() => {
              const list = getFilteredStores(activityFilter);
              const titles: Record<string, string> = {
                activeToday: 'Actives aujourd\'hui',
                notToday: 'Pas ouvert aujourd\'hui',
                inactive1w: 'Inactives 1 semaine+',
                inactive2w: 'Inactives 2 semaines+',
                inactive1m: 'Inactives 1 mois+',
                never: 'Jamais connectées',
                paid: 'Abonnements payants',
                trial: 'Essai gratuit',
                expired: 'Abonnements expirés',
                pending: 'Abonnements en attente',
              };
              return (
                <div style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, animation: 'fadeIn 0.2s ease' }}>
                  <div style={{ background: 'var(--bg-card)', borderRadius: 14, width: '100%', maxWidth: 520, maxHeight: '80vh', overflow: 'auto', border: '1px solid var(--border)', animation: 'scaleIn 0.2s ease' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--border)' }}>
                      <h3 style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{titles[activityFilter] || activityFilter}</h3>
                      <button onClick={() => setActivityFilter(null)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 18, cursor: 'pointer', padding: '4px 8px' }}>✕</button>
                    </div>
                    <div style={{ padding: '8px 0' }}>
                      {list.length === 0 ? (
                        <div style={{ padding: '30px 20px', textAlign: 'center', color: 'var(--text-muted)', fontSize: 13 }}>Aucune boutique</div>
                      ) : (
                        list.map((s, i) => {
                          const st = sc(s.subscriptionStatus);
                          const da = s.lastActiveAt ? Math.floor((Date.now() - new Date(s.lastActiveAt).getTime()) / 86400000) : null;
                          return (
                            <div key={i} style={{ padding: '12px 20px', borderBottom: i < list.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>{s.storeName}</div>
                                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>
                                  {s.phone} · {da !== null ? (da === 0 ? 'Aujourd\'hui' : `Il y a ${da}j`) : 'Jamais'}
                                </div>
                              </div>
                              <span style={{ padding: '2px 7px', borderRadius: 10, fontSize: 10, fontWeight: 500, background: st.b, color: st.c, whiteSpace: 'nowrap', marginLeft: 8 }}>{st.l}</span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })()}
          </div>
        )}

        {/* ─── OBJECTIFS ─── */}
        {tab === 'objectifs' && (
          <div className="tab-content">
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Mes objectifs</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>Suivez votre progression et débloquez des récompenses</p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2,1fr)', gap: 16, marginBottom: 24 }}>
              {/* Main Goal */}
              <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>🎯</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Objectif du mois</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{goal} boutiques payantes</div>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 8 }}>
                  <span style={{ fontSize: 36, fontWeight: 700, color: activeSubs >= goal ? '#22c55e' : '#eab308' }}>{activeSubs}</span>
                  <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>/ {goal} payantes</span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>{totalStores} boutique{totalStores > 1 ? 's' : ''} installée{totalStores > 1 ? 's' : ''} au total</div>
                <div style={{ height: 8, background: 'var(--bg-progress)', borderRadius: 4, overflow: 'hidden', marginBottom: 8 }}>
                  <div className="bar-fill" style={{ width: `${Math.min((activeSubs / goal) * 100, 100)}%`, height: '100%', background: activeSubs >= goal ? 'linear-gradient(90deg,#22c55e,#16a34a)' : 'linear-gradient(90deg,#a855f7,#6366f1)', borderRadius: 4 }} />
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {activeSubs >= goal ? '✅ Objectif atteint ! Félicitations !' : `Encore ${goal - activeSubs} boutique${goal - activeSubs > 1 ? 's' : ''} payante${goal - activeSubs > 1 ? 's' : ''} pour atteindre l'objectif`}
                </div>
                {activeSubs >= goal && (
                  <div style={{ marginTop: 12, padding: '10px 14px', background: '#22c55e10', borderRadius: 8, border: '1px solid #22c55e20', fontSize: 12, color: '#22c55e', fontWeight: 500, textAlign: 'center' }}>
                    ✅ Objectif atteint ! Vous êtes en phase suivi — 800 FCFA/abonnement actif par mois.
                  </div>
                )}
              </div>

              {/* Badges */}
              <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <span style={{ fontSize: 28 }}>🏆</span>
                  <div>
                    <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>Badges et récompenses</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Votre progression</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { label: '1ère boutique installée', done: totalStores >= 1, icon: '🌟', current: totalStores, target: 1 },
                    { label: '10 boutiques installées', done: totalStores >= 10, icon: '⭐', current: totalStores, target: 10 },
                    { label: '5 boutiques payantes', done: activeSubs >= 5, icon: '💎', current: activeSubs, target: 5 },
                    { label: '50 boutiques payantes', done: activeSubs >= 50, icon: '👑', current: activeSubs, target: 50 },
                    { label: '100 boutiques payantes', done: activeSubs >= 100, icon: '🏆', current: activeSubs, target: 100 },
                  ].map((b, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: b.done ? '#22c55e10' : 'var(--bg-hover)', borderRadius: 8, border: `1px solid ${b.done ? '#22c55e20' : 'var(--border)'}` }}>
                      <span style={{ fontSize: 16, opacity: b.done ? 1 : 0.3 }}>{b.icon}</span>
                      <span style={{ flex: 1, fontSize: 12, color: b.done ? '#22c55e' : 'var(--text-muted)', fontWeight: b.done ? 600 : 400 }}>{b.label}</span>
                      {b.done ? <span style={{ fontSize: 11, color: '#22c55e' }}>✓</span> : <span style={{ fontSize: 11, color: 'var(--text-dim)' }}>{b.current}/{b.target}</span>}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap: 12 }}>
              {[
                { label: 'Boutiques installées', value: String(totalStores), sub: `+${newThisMonth} ce mois` },
                { label: 'Taux de conversion', value: `${convRate}%`, sub: `${activeSubs} actives sur ${totalStores}` },
                { label: 'Commissions gagnées', value: fmt(totalComm), sub: `${fmt(monthComm)} ce mois` },
                { label: 'Jours d\'activité', value: String(agent?.createdAt ? Math.floor((Date.now() - new Date(agent.createdAt).getTime()) / 86400000) : 0), sub: 'Depuis votre inscription' },
              ].map((k, i) => (
                <div key={i} className="stat-card" style={{ padding: 16, background: 'var(--bg-card)', borderRadius: 10, border: '1px solid var(--border)', textAlign: 'center' }}>
                  <div style={{ fontSize: 22, fontWeight: 700, color: 'var(--text-primary)' }}>{k.value}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{k.label}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-dim)', marginTop: 2 }}>{k.sub}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── PROFIL ─── */}
        {tab === 'profil' && (
          <div className="tab-content">
            <h2 style={{ fontSize: 20, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>Mon profil</h2>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '0 0 24px' }}>Informations personnelles et KYC</p>

            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap: 20 }}>
              {/* Carte identité */}
              <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
                  <div style={{ width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg,#a855f7,#6366f1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: '#fff' }}>
                    {(agent?.firstName?.[0] || 'A').toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 600, color: 'var(--text-primary)' }}>{agent?.firstName} {agent?.lastName}</div>
                    <div style={{ fontSize: 13, color: '#a855f7', fontFamily: 'monospace', marginTop: 2 }}>{agent?.code}</div>
                    <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: 12, fontSize: 10, fontWeight: 600, background: agent?.isApproved ? '#22c55e18' : '#eab30818', color: agent?.isApproved ? '#22c55e' : '#eab308', marginTop: 4 }}>
                      {agent?.isApproved ? '✅ Approuvé' : '⏳ En validation'}
                    </span>
                  </div>
                </div>

                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Informations personnelles</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 20 }}>
                  {[
                    ['Prénom', agent?.firstName || '—'],
                    ['Nom', agent?.lastName || '—'],
                    ['Sexe', agent?.gender === 'male' ? 'Masculin' : agent?.gender === 'female' ? 'Féminin' : '—'],
                    ['Date de naissance', agent?.birthDate ? new Date(agent.birthDate).toLocaleDateString('fr-FR') : '—'],
                    ['Téléphone', agent?.phone || '—'],
                  ].map(([l, v], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{l}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Localisation</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 20 }}>
                  {[
                    ['Pays', agent?.country || '—'],
                    ['Ville', agent?.city || '—'],
                    ['Région', agent?.region || '—'],
                  ].map(([l, v], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{l}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>

                <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-muted)', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Pièce d'identité</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                  {[
                    ['Type', agent?.idType ? (agent.idType === 'passport' ? 'Passeport' : agent.idType === 'national_id' ? 'CNI' : agent.idType === 'drivers_license' ? 'Permis de conduire' : agent.idType) : '—'],
                    ['Numéro', agent?.idNumber || '—'],
                  ].map(([l, v], i) => (
                    <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{l}</span>
                      <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Code + Compte + Stats */}
              <div>
                <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', textAlign: 'center', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>Votre code agent</h3>
                  <div style={{ fontSize: 28, fontWeight: 700, color: '#a855f7', fontFamily: 'monospace', letterSpacing: 4, marginBottom: 8 }}>{agent?.code}</div>
                  <p style={{ fontSize: 11, color: 'var(--text-muted)', margin: '0 0 16px' }}>Partagez ce code aux commerçants lors de leur inscription</p>
                  <button onClick={() => { navigator.clipboard.writeText(agent?.code || ''); }} style={{ padding: '10px 20px', background: '#a855f7', border: 'none', borderRadius: 8, color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>📋 Copier le code</button>
                </div>

                <div style={{ padding: 24, background: 'var(--bg-card)', borderRadius: 14, border: '1px solid var(--border)', marginBottom: 16 }}>
                  <h3 style={{ fontSize: 14, fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 12px' }}>Compte</h3>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                    {[
                      ['Membre depuis', agent?.createdAt ? new Date(agent.createdAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' }) : '—'],
                      ['Dernière connexion', agent?.lastLoginAt ? new Date(agent.lastLoginAt).toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Jamais'],
                      ['Statut', agent?.isActive ? 'Actif' : 'Désactivé'],
                    ].map(([l, v], i) => (
                      <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                        <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{l}</span>
                        <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>{v}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 12 }}>
                  {[
                    { label: 'Boutiques', value: String(totalStores), color: 'var(--text-primary)' },
                    { label: 'Actives', value: String(activeSubs), color: '#22c55e' },
                    { label: 'Commissions', value: fmt(totalComm), color: '#a855f7' },
                    { label: 'Conversion', value: `${convRate}%`, color: '#eab308' },
                  ].map((k, i) => (
                    <div key={i} style={{ padding: 16, background: 'var(--bg-hover)', borderRadius: 10, textAlign: 'center', border: '1px solid var(--border)' }}>
                      <div style={{ fontSize: 20, fontWeight: 700, color: k.color }}>{k.value}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>{k.label}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Store Modal */}
      {showStore && selected && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}
          onClick={() => setShowStore(false)}>
          <div className="tab-content" style={{ background: 'var(--bg-card)', borderRadius: 16, width: '100%', maxWidth: 420, maxHeight: '85vh', overflow: 'auto', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid var(--border)' }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 600, color: 'var(--text-primary)' }}>{selected.storeName}</h3>
              <button onClick={() => setShowStore(false)} style={{ width: 28, height: 28, borderRadius: 7, background: 'var(--bg-progress)', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <div style={{ padding: 24 }}>
              {[
                ['Propriétaire', selected.ownerName || '-'],
                ['Téléphone', selected.phone],
                ['Installation', selected.createdAt ? new Date(selected.createdAt).toLocaleDateString('fr-FR') : '-'],
                ['Dernière activité', selected.lastActiveAt ? new Date(selected.lastActiveAt).toLocaleDateString('fr-FR') : 'Jamais'],
              ].map(([l, v], i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>{l}</span>
                  <span style={{ color: 'var(--text-primary)', fontSize: 13, fontWeight: 500 }}>{v}</span>
                </div>
              ))}
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: 13 }}>Statut</span>
                {(() => { const st = sc(selected.subscriptionStatus); return <span style={{ padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 500, background: st.b, color: st.c }}>{st.l}</span>; })()}
              </div>
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                <a href={`tel:${selected.phone}`} style={{ flex: 1, padding: '10px', background: '#22c55e', border: 'none', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>📞 Appeler</a>
                <a href={`https://wa.me/${selected.phone.replace(/[^0-9]/g, '')}`} target="_blank" style={{ flex: 1, padding: '10px', background: '#22c55e', border: 'none', borderRadius: 8, color: 'var(--text-primary)', cursor: 'pointer', fontSize: 13, fontWeight: 600, textAlign: 'center', textDecoration: 'none' }}>💬 WhatsApp</a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Icon({ name }: { name: string }) {
  const p = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  switch (name) {
    case 'grid': return <svg {...p}><rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" /></svg>;
    case 'store': return <svg {...p}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>;
    case 'wallet': return <svg {...p}><rect x="1" y="4" width="22" height="16" rx="2" /><line x1="1" y1="10" x2="23" y2="10" /></svg>;
    case 'activity': return <svg {...p}><polyline points="22 12 18 12 15 21 9 3 6 12 2 12" /></svg>;
    case 'target': return <svg {...p}><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="6" /><circle cx="12" cy="12" r="2" /></svg>;
    case 'user': return <svg {...p}><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>;
    case 'logout': return <svg {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>;
    default: return null;
  }
}
