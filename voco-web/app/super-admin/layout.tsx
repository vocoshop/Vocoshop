'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import dynamic from 'next/dynamic';
const AIAgent = dynamic(() => import('./AIAgent'), { ssr: false });

const API = process.env.NEXT_PUBLIC_API_URL;
const NAV_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: 'M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6', href: '/super-admin/dashboard' },
  { id: 'boutiques', label: 'Boutiques', icon: 'M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 5h1m-1 4h1m-1 8h1', href: '/super-admin/boutiques' },
  { id: 'agents', label: 'Agents', icon: 'M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z', href: '/super-admin/agents' },
  { id: 'abonnements', label: 'Abonnements', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', href: '/super-admin/abonnements' },
  { id: 'paiements', label: 'Paiements', icon: 'M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z', href: '/super-admin/paiements' },
  { id: 'parrainages', label: 'Parrainages', icon: 'M13 7h8m0 0v8m0-8l-8 8-4-4-6 6', href: '/super-admin/parrainages' },
  { id: 'notifications', label: 'Notifications', icon: 'M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9', href: '/super-admin/notifications' },
  { id: 'support', label: 'Support', icon: 'M18.364 5.636l-3.536 3.536m0 5.656l3.536 3.536M9.172 9.172L5.636 5.636m3.536 9.192l-3.536 3.536M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-5 0a4 4 0 11-8 0 4 4 0 018 0z', href: '/super-admin/support' },
  { id: 'analytics', label: 'Analytics', icon: 'M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z', href: '/super-admin/analytics' },
  { id: 'logs', label: 'Logs systeme', icon: 'M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z', href: '/super-admin/logs' },
  { id: 'securite', label: 'Sécurité', icon: 'M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z', href: '/super-admin/securite' },
  { id: 'preuves', label: 'Preuves Blockchain', icon: 'M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4', href: '/super-admin/preuves' },
  { id: 'partenaires', label: 'Partenaires Financiers', icon: 'M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z', href: '/super-admin/partenaires' },
  { id: 'demandes', label: 'Demandes Financement', icon: 'M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01', href: '/super-admin/demandes' },
  { id: 'admin-managers', label: 'Admin Managers', icon: 'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z', href: '/super-admin/admin-managers' },
  { id: 'parametres', label: 'Parametres', icon: 'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z M15 12a3 3 0 11-6 0 3 3 0 016 0z', href: '/super-admin/parametres' },
];

const PLATFORM_STATUS = [
  { name: 'API', status: 'online' as const },
  { name: 'MongoDB', status: 'online' as const },
  { name: 'Payments', status: 'online' as const },
  { name: 'Webhook', status: 'online' as const },
  { name: 'Queue', status: 'online' as const },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
const [width, setWidth] = useState(0);
const [notifOpen, setNotifOpen] = useState(false);
const [notifCount, setNotifCount] = useState(0);
const [recentNotifs, setRecentNotifs] = useState<any[]>([]);
const [searchOpen, setSearchOpen] = useState(false);
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState<{ type: string; items: any[] }>({ type: '', items: [] });
const [searchLoading, setSearchLoading] = useState(false);
const [darkMode, setDarkMode] = useState(true);
const [quickActionsOpen, setQuickActionsOpen] = useState(false);
const [adminName, setAdminName] = useState('Admin');
const searchRef = useRef<HTMLInputElement>(null);

const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

useEffect(() => {
  const info = JSON.parse(localStorage.getItem('adminInfo') || '{}');
  setAdminName(info?.name || info?.email?.split('@')[0] || 'Admin');
}, []);

  useEffect(() => {
    const h = () => setWidth(window.innerWidth);
    h(); window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  const isMobile = width > 0 && width < 768;

  useEffect(() => {
    if (!token) router.push('/admin/login');
  }, []);

  useEffect(() => {
    if (!token) return;
    const fetchAlerts = async () => {
      try {
        const h = { Authorization: `Bearer ${token}` };
        const [sr, ar] = await Promise.all([
          fetch(`${API}/admin/stores?limit=500`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/agents?approved=true&limit=500`, { headers: h }).catch(() => null),
        ]);
        if (sr?.status === 401 || ar?.status === 401) {
          localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo');
          window.location.href = '/admin/login'; return;
        }
        const alerts: any[] = [];
        if (sr?.ok) {
          const sd = await sr.json();
          const stores = sd.stores || [];
          const expiring = stores.filter((s: any) => {
            if (!s.paidUntil) return false;
            const days = Math.ceil((new Date(s.paidUntil).getTime() - Date.now()) / 86400000);
            return days <= 3 && days >= 0;
          });
          const expired = stores.filter((s: any) => {
            if (!s.paidUntil) return false;
            return new Date(s.paidUntil).getTime() < Date.now();
          });
          const active = stores.filter((s: any) => s.subscriptionStatus === 'active').length;
          if (expiring.length > 0) alerts.push({ _id: 'a1', title: `${expiring.length} abonnement${expiring.length > 1 ? 's' : ''} expire${expiring.length === 1 ? 'nt' : 's'} bientôt`, message: `${expiring.map((s: any) => s.storeName).slice(0, 2).join(', ')}${expiring.length > 2 ? ` et ${expiring.length - 2} autres` : ''}`, type: 'warning', read: false });
          if (expired.length > 0) alerts.push({ _id: 'a2', title: `${expired.length} abonnement${expired.length > 1 ? 's' : ''} expiré${expired.length === 1 ? '' : 's'}`, message: `Vérifiez les boutiques concernées`, type: 'error', read: false });
          if (active > stores.length * 0.7) alerts.push({ _id: 'a3', title: 'Taux activation excellent', message: `${Math.round((active / stores.length) * 100)}% des boutiques sont actives`, type: 'success', read: false });
        }
        if (ar?.ok) {
          const ad = await ar.json();
          const agents = ad.agents || [];
          const pending = agents.filter((a: any) => !a.isApproved).length;
          if (pending > 0) alerts.push({ _id: 'a4', title: `${pending} agent${pending > 1 ? 's' : ''} en attente`, message: `${pending} demande${pending > 1 ? 's' : ''} à approuver`, type: 'info', read: false });
        }
        const sortedAlerts = alerts.sort((a: any, b: any) => (a.read ? 1 : 0) - (b.read ? 1 : 0));
        setRecentNotifs(sortedAlerts);
        setNotifCount(sortedAlerts.filter((n: any) => !n.read).length);
      } catch {}
    };
    fetchAlerts();
    const iv = setInterval(fetchAlerts, 60000);
    return () => clearInterval(iv);
  }, [token]);

  useEffect(() => {
    if (!searchOpen || !searchRef.current) return;
    searchRef.current.focus();
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') { setSearchOpen(false); setSearchQuery(''); setSearchResults({ type: '', items: [] }); } };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [searchOpen]);

  useEffect(() => {
    if (searchQuery.length < 2) { setSearchResults({ type: '', items: [] }); return; }
    const t = setTimeout(async () => {
      setSearchLoading(true);
      const h = { Authorization: `Bearer ${token}` };
      try {
        const [sr, ar] = await Promise.all([
          fetch(`${API}/admin/stores?limit=200`, { headers: h }).catch(() => null),
          fetch(`${API}/admin/agents?approved=true&limit=200`, { headers: h }).catch(() => null),
        ]);
        if (sr?.status === 401 || ar?.status === 401) {
          localStorage.removeItem('adminToken'); localStorage.removeItem('adminInfo');
          window.location.href = '/admin/login'; return;
        }
        const q = searchQuery.toLowerCase();
        if (sr?.ok) {
          const sd = await sr.json();
          const matches = (sd.stores || []).filter((s: any) =>
            s.storeName?.toLowerCase().includes(q) || s.phone?.includes(q) || s.city?.toLowerCase().includes(q) || s.storeId?.includes(q)
          ).slice(0, 5);
          if (matches.length > 0) setSearchResults({ type: 'stores', items: matches });
        }
        if (ar?.ok) {
          const ad = await ar.json();
          const matches = (ad.agents || []).filter((a: any) =>
            a.name?.toLowerCase().includes(q) || a.phone?.includes(q) || a.code?.toLowerCase().includes(q) || a.city?.toLowerCase().includes(q)
          ).slice(0, 5);
          if (matches.length > 0) setSearchResults({ type: 'agents', items: matches });
        }
      } catch {}
      setSearchLoading(false);
    }, 300);
    return () => clearTimeout(t);
  }, [searchQuery, token]);

  const handleSearchResult = (item: any, type: string) => {
    setSearchOpen(false);
    setSearchQuery('');
    setSearchResults({ type: '', items: [] });
    if (type === 'store') router.push(`/super-admin/boutiques/${item.storeId || item._id}`);
    else router.push(`/super-admin/agents/${item.id || item._id}`);
  };

  useEffect(() => {
    if (!notifOpen) return;
    const h = () => setNotifOpen(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [notifOpen]);

  useEffect(() => {
    if (!quickActionsOpen) return;
    const h = () => setQuickActionsOpen(false);
    document.addEventListener('click', h);
    return () => document.removeEventListener('click', h);
  }, [quickActionsOpen]);

  const currentSection = NAV_ITEMS.find(i => pathname?.startsWith(i.href))?.id || 'dashboard';
  const sectionLabel = NAV_ITEMS.find(i => i.id === currentSection)?.label || 'Dashboard';

  const handleLogout = useCallback(() => {
    localStorage.removeItem('adminToken');
    localStorage.removeItem('adminInfo');
    router.push('/admin/login');
  }, [router]);

  const sw = isMobile ? '100%' : sidebarCollapsed ? '72px' : '260px';
  const mm = isMobile ? 0 : sidebarCollapsed ? '72px' : '260px';

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#0a0a0b', color: '#fafafa', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {isMobile && sidebarOpen && (
        <div className="overlay" onClick={() => setSidebarOpen(false)} />
      )}

      <aside className={`sidebar-mobile ${isMobile && sidebarOpen ? 'open' : ''}`} style={{
        width: isMobile ? '260px' : sw, background: '#111113', borderRight: '1px solid #27272a',
        display: 'flex', flexDirection: 'column', transition: 'width 0.2s', position: 'fixed',
        height: '100vh', zIndex: 200, overflow: 'hidden',
      }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #27272a', display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 700, color: '#fff' }}>V</div>
            {(!sidebarCollapsed || isMobile) && <span style={{ fontSize: 18, fontWeight: 700, color: '#fff' }}>VocoShop</span>}
          </div>
          {!isMobile && (
            <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} style={{ background: 'transparent', border: 'none', color: '#52525b', cursor: 'pointer', fontSize: 14, padding: '4px 8px', borderRadius: 4 }}>
              {sidebarCollapsed ? '→' : '←'}
            </button>
          )}
        </div>

        <nav style={{ flex: 1, padding: '12px 10px', display: 'flex', flexDirection: 'column', gap: 2, overflow: 'auto' }}>
          {NAV_ITEMS.map(item => {
            const isActive = pathname?.startsWith(item.href);
            return (
              <button key={item.id} onClick={() => { router.push(item.href); setSidebarOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
                background: isActive ? '#a855f715' : 'transparent', border: 'none', color: isActive ? '#a855f7' : '#a1a1aa',
                cursor: 'pointer', fontSize: 13, fontWeight: isActive ? 600 : 400, width: '100%', textAlign: 'left',
                transition: 'all 0.15s',
              }}>
                <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ flexShrink: 0 }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={item.icon} />
                </svg>
                {(!sidebarCollapsed || isMobile) && <span className="hide-mobile">{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {(!sidebarCollapsed || isMobile) && (
          <div style={{ padding: '12px 16px', borderTop: '1px solid #27272a', margin: 0 }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: '#52525b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: 10 }}>Plateforme</div>
            {PLATFORM_STATUS.map(p => (
              <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.status === 'online' ? '#22c55e' : '#ef4444' }} />
                <span style={{ fontSize: 12, color: '#71717a' }}>{p.name}</span>
                <span style={{ fontSize: 11, color: '#52525b', marginLeft: 'auto' }}>{p.status === 'online' ? 'Online' : 'Offline'}</span>
              </div>
            ))}
          </div>
        )}

        <div style={{ padding: '12px 16px', borderTop: '1px solid #27272a' }}>
          <button onClick={handleLogout} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 8,
            background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer',
            fontSize: 13, width: '100%', textAlign: 'left',
          }}>
            <svg width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {(!sidebarCollapsed || isMobile) && <span className="hide-mobile">Deconnexion</span>}
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, marginLeft: mm, minHeight: '100vh', transition: 'margin-left 0.2s', width: '100%' }}>
        <header style={{
          padding: isMobile ? '12px 16px' : '16px 32px', borderBottom: '1px solid #27272a',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          position: 'sticky', top: 0, background: '#0a0a0b', zIndex: 50,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {isMobile && (
              <button onClick={() => setSidebarOpen(true)} style={{ background: '#18181b', border: 'none', color: '#fff', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', fontSize: 18 }}>
                ☰
              </button>
            )}
            <div>
              <h1 style={{ fontSize: isMobile ? 16 : 20, fontWeight: 600, color: '#fff', margin: 0 }}>Bonjour {adminName} 👋</h1>
              <p style={{ fontSize: 12, color: '#71717a', margin: '2px 0 0' }}>{sectionLabel} · Vue administrateur</p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? 8 : 16 }}>
            {!isMobile && (
              <div style={{ position: 'relative' }}>
                <div onClick={() => setSearchOpen(true)} style={{
                  background: '#18181b', border: '1px solid #27272a', borderRadius: 8,
                  padding: '8px 14px 8px 36px', fontSize: 13, color: '#fff', cursor: 'text',
                  width: 220, display: 'flex', alignItems: 'center', gap: 8,
                }}>
                  <svg style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#52525b' }} width={14} height={14} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span style={{ color: '#52525b' }}>Rechercher...</span>
                  <span style={{ marginLeft: 'auto', fontSize: 10, background: '#27272a', padding: '2px 6px', borderRadius: 4, color: '#71717a' }}>⌘K</span>
                </div>
              </div>
            )}

            <div style={{ position: 'relative' }}>
              <button onClick={(e) => { e.stopPropagation(); setNotifOpen(!notifOpen); }} style={{ position: 'relative', background: '#18181b', border: 'none', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', color: '#a1a1aa', fontSize: 16 }}>
                🔔
                {notifCount > 0 && (
                  <span style={{ position: 'absolute', top: 2, right: 2, minWidth: 16, height: 16, borderRadius: 8, background: '#ef4444', color: '#fff', fontSize: 9, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                    {notifCount > 9 ? '9+' : notifCount}
                  </span>
                )}
              </button>
              {notifOpen && (
                <div onClick={e => e.stopPropagation()} style={{ position: 'absolute', right: 0, top: '100%', marginTop: 8, width: 340, background: '#18181b', borderRadius: 12, border: '1px solid #27272a', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', zIndex: 300, overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '1px solid #27272a', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>Alertes</span>
                    <button onClick={() => { setNotifOpen(false); router.push('/super-admin/notifications'); }} style={{ background: 'transparent', border: 'none', color: '#a855f7', fontSize: 11, fontWeight: 500, cursor: 'pointer' }}>Historique</button>
                  </div>
                  <div style={{ maxHeight: 360, overflow: 'auto' }}>
                    {recentNotifs.length === 0 ? (
                      <div style={{ padding: '24px 16px', textAlign: 'center', fontSize: 12, color: '#52525b' }}>Tout est en ordre ✓</div>
                    ) : recentNotifs.map(n => (
                      <div key={n._id} style={{
                        padding: '12px 16px', borderBottom: '1px solid #27272a', cursor: 'pointer',
                        background: n.read ? 'transparent' : (n.type === 'error' ? '#ef444410' : n.type === 'warning' ? '#eab30810' : '#3b82f610'),
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 16 }}>{n.type === 'error' ? '🔴' : n.type === 'warning' ? '🟡' : n.type === 'success' ? '🟢' : '🔵'}</span>
                          <span style={{ fontSize: 12, fontWeight: 600, color: '#fff' }}>{n.title}</span>
                        </div>
                        <div style={{ fontSize: 11, color: '#71717a', marginTop: 4 }}>{n.message}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div style={{
              width: 36, height: 36, borderRadius: 8,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 13, fontWeight: 600, color: '#fff', cursor: 'pointer',
            }}>{adminName[0].toUpperCase()}</div>
            <button onClick={() => setQuickActionsOpen(!quickActionsOpen)} style={{ position: 'relative', background: '#18181b', border: 'none', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', color: '#a1a1aa', fontSize: 16 }}>
              ⚡
            </button>
            <button onClick={() => setDarkMode(!darkMode)} style={{ background: '#18181b', border: 'none', width: 36, height: 36, borderRadius: 8, cursor: 'pointer', color: '#a1a1aa', fontSize: 16 }}>
              {darkMode ? '🌙' : '☀️'}
            </button>
          </div>
        </header>

        {searchOpen && (
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 400, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: '15vh' }} onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults({ type: '', items: [] }); }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 560, background: '#18181b', borderRadius: 16, border: '1px solid #27272a', overflow: 'hidden', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '16px 20px', borderBottom: '1px solid #27272a' }}>
                <svg style={{ color: '#52525b' }} width={18} height={18} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input ref={searchRef} value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Rechercher boutiques, agents..." style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontSize: 15, color: '#fff' }} />
                <button onClick={() => { setSearchOpen(false); setSearchQuery(''); setSearchResults({ type: '', items: [] }); }} style={{ background: '#27272a', border: 'none', color: '#71717a', cursor: 'pointer', padding: '4px 10px', borderRadius: 6, fontSize: 11 }}>ESC</button>
              </div>
              <div style={{ maxHeight: 400, overflow: 'auto' }}>
                {searchLoading && <div style={{ padding: '24px 20px', textAlign: 'center', color: '#52525b', fontSize: 13 }}>Recherche...</div>}
                {!searchLoading && searchQuery.length < 2 && <div style={{ padding: '24px 20px', textAlign: 'center', color: '#52525b', fontSize: 13 }}>Tapez au moins 2 caracteres</div>}
                {!searchLoading && searchQuery.length >= 2 && searchResults.type === 'stores' && (
                  <div>
                    <div style={{ padding: '8px 20px', fontSize: 11, fontWeight: 600, color: '#52525b', textTransform: 'uppercase', borderBottom: '1px solid #27272a' }}>Boutiques</div>
                    {searchResults.items.map((s: any) => {
                      const statusColors: Record<string, { bg: string; color: string }> = {
                        active: { bg: '#22c55e20', color: '#22c55e' },
                        expired: { bg: '#ef444420', color: '#ef4444' },
                        trial: { bg: '#eab30820', color: '#eab308' },
                        grace: { bg: '#3b82f620', color: '#3b82f6' },
                      };
                      const sc = statusColors[s.subscriptionStatus] || { bg: '#71717a20', color: '#71717a' };
                      return (
                        <button key={s.storeId || s._id} onClick={() => handleSearchResult(s, 'store')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #27272a', cursor: 'pointer', textAlign: 'left' }}>
                          <span style={{ width: 32, height: 32, borderRadius: 8, background: '#a855f720', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🏪</span>
                          <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{s.storeName}</div><div style={{ fontSize: 11, color: '#71717a' }}>{s.phone} · {s.city || '-'}</div></div>
                          <span style={{ padding: '3px 10px', borderRadius: 20, fontSize: 10, fontWeight: 500, background: sc.bg, color: sc.color }}>
                            {s.subscriptionStatus === 'active' ? 'Actif' : s.subscriptionStatus === 'trial' ? 'Trial' : s.subscriptionStatus === 'grace' ? 'Grace' : s.subscriptionStatus === 'expired' ? 'Expire' : '-'}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {!searchLoading && searchQuery.length >= 2 && searchResults.type === 'agents' && (
                  <div>
                    <div style={{ padding: '8px 20px', fontSize: 11, fontWeight: 600, color: '#52525b', textTransform: 'uppercase', borderBottom: '1px solid #27272a' }}>Agents</div>
                    {searchResults.items.map((a: any) => (
                      <button key={a.id || a._id} onClick={() => handleSearchResult(a, 'agent')} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #27272a', cursor: 'pointer', textAlign: 'left' }}>
                        <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>{(a.name || a.code || 'A')[0]}</div>
                        <div style={{ flex: 1 }}><div style={{ fontSize: 13, fontWeight: 500, color: '#fff' }}>{a.name || a.code}</div><div style={{ fontSize: 11, color: '#71717a' }}>{a.phone} · {a.city || '-'}</div></div>
                        <code style={{ background: '#27272a', padding: '2px 6px', borderRadius: 4, fontSize: 10, color: '#a855f7' }}>{a.code}</code>
                      </button>
                    ))}
                  </div>
                )}
                {!searchLoading && searchQuery.length >= 2 && searchResults.items.length === 0 && <div style={{ padding: '24px 20px', textAlign: 'center', color: '#52525b', fontSize: 13 }}>Aucun resultat pour "{searchQuery}"</div>}
              </div>
            </div>
          </div>
        )}

        {quickActionsOpen && (
          <div onClick={e => e.stopPropagation()} style={{ position: 'fixed', top: 70, right: 32, zIndex: 300 }}>
            <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', width: 200, overflow: 'hidden', boxShadow: '0 10px 40px rgba(0,0,0,0.4)' }}>
              {[
                { icon: '🏪', label: 'Nouvelle boutique', href: '/super-admin/boutiques' },
                { icon: '👤', label: 'Nouvel agent', href: '/admin/candidatures' },
                { icon: '📋', label: 'Voir logs', href: '/super-admin/logs' },
                { icon: '📊', label: 'Analytics', href: '/super-admin/analytics' },
                { icon: '💬', label: 'Support', href: '/super-admin/support' },
                { icon: '⚙️', label: 'Parametres', href: '/super-admin/parametres' },
              ].map(a => (
                <button key={a.label} onClick={() => { router.push(a.href); setQuickActionsOpen(false); }} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 16px', width: '100%', background: 'transparent', border: 'none', borderBottom: '1px solid #27272a', cursor: 'pointer', fontSize: 13, color: '#a1a1aa', textAlign: 'left' }}>
                  <span>{a.icon}</span> {a.label}
                </button>
              ))}
            </div>
          </div>
        )}

        <div style={{ padding: isMobile ? '16px' : '24px 32px', animation: 'fadeIn 0.3s ease-out', maxWidth: 1600, margin: '0 auto' }}>
          {children}
        </div>
      </main>
      <AIAgent />
    </div>
  );
}
