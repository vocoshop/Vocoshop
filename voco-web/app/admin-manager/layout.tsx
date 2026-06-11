'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';

const API = process.env.NEXT_PUBLIC_API_URL;

const navItems = [
  { icon: '🏠', label: 'Dashboard', path: '/admin-manager/dashboard' },
  { icon: '👨', label: 'Agents', path: '/admin-manager/agents' },
  { icon: '🏪', label: 'Boutiques', path: '/admin-manager/boutiques' },
  { icon: '💰', label: 'Commissions', path: '/admin-manager/commissions' },
  { icon: '📈', label: 'Performances', path: '/admin-manager/performances' },
  { icon: '🔁', label: 'Comparer', path: '/admin-manager/comparer' },
  { icon: '🚨', label: 'Alertes', path: '/admin-manager/alertes' },
  { icon: '💬', label: 'Support', path: '/admin-manager/support' },
  { icon: '🔔', label: 'Notifications', path: '/admin-manager/notifications' },
  { icon: '⚙️', label: 'Paramètres', path: '/admin-manager/parametres' },
];

export default function AdminManagerLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [manager, setManager] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [showSearch, setShowSearch] = useState(false);
  const searchRef = useRef<any>(null);

  useEffect(() => {
    const token = localStorage.getItem('managerToken');
    if (token) { try { setManager(JSON.parse(localStorage.getItem('managerInfo') || '{}')); } catch {} }
    const h = () => setIsMobile(window.innerWidth < 768);
    h(); window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);

  useEffect(() => {
    const handleKey = (e: any) => { if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(true); } };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const handleSearch = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 2) { setSearchResults([]); return; }
    try {
      const token = localStorage.getItem('managerToken') || '';
      const headers = token ? { Authorization: `Bearer ${token}` } as const : undefined;
      const api = token ? '/api' : (process.env.NEXT_PUBLIC_API_URL || '/api');
      const [ar, sr] = await Promise.all([
        fetch(`${api}/admin-manager/agents?q=${encodeURIComponent(q)}&limit=5`, { headers }).catch(() => ({ ok: false, status: 0, json: () => ({}) })),
        fetch(`${api}/admin-manager/stores?q=${encodeURIComponent(q)}&limit=5`, { headers }).catch(() => ({ ok: false, status: 0, json: () => ({}) })),
      ]);
      if (ar?.status === 401 || sr?.status === 401) {
        localStorage.removeItem('managerToken'); localStorage.removeItem('managerInfo');
        window.location.href = '/manager-login'; return;
      }
      const results: any[] = [];
      if (ar?.ok) { const d: any = await ar.json(); (d.agents || []).forEach((a: any) => results.push({ type: 'agent', data: a })); }
      if (sr?.ok) { const d: any = await sr.json(); (d.stores || []).forEach((s: any) => results.push({ type: 'store', data: s })); }
      setSearchResults(results);
    } catch {}
  };

  const sidebarW = collapsed ? 64 : 220;

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: '#09090b', color: '#fff', fontFamily: 'system-ui' }}>
      {/* SIDEBAR */}
      <aside style={{
        width: isMobile ? (mobileOpen ? 220 : 0) : sidebarW,
        background: '#111113',
        borderRight: '1px solid #1a1a1e',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.25s ease',
        overflow: 'hidden',
        position: isMobile ? 'fixed' : 'sticky',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 100,
      }}>
        {/* Logo */}
        <div style={{ padding: collapsed ? '16px 12px' : '20px', display: 'flex', alignItems: 'center', gap: 10, borderBottom: '1px solid #1a1a1e' }}>
          <div style={{ width: 32, height: 32, borderRadius: 8, background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, fontWeight: 800, color: '#fff', flexShrink: 0 }}>V</div>
          {!collapsed && !isMobile && <div><div style={{ fontSize: 15, fontWeight: 700, color: '#fff' }}>Voco<span style={{ color: '#a855f7' }}>Shop</span></div><div style={{ fontSize: 10, color: '#71717a', marginTop: -2 }}>Admin Manager</div></div>}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '12px 8px', overflowY: 'auto' }}>
          {navItems.map(item => {
            const active = pathname === item.path || pathname.startsWith(item.path + '/');
            return (
              <button key={item.path} onClick={() => { router.push(item.path); if (isMobile) setMobileOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: collapsed ? '10px 12px' : '10px 12px',
                marginBottom: 2, borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: active ? 600 : 400,
                background: active ? '#1a1a1e' : 'transparent', color: active ? '#fff' : '#71717a', transition: 'all 0.15s',
                justifyContent: collapsed ? 'center' : 'flex-start',
              }}>
                <span style={{ fontSize: 16 }}>{item.icon}</span>
                {!collapsed && <span style={{ whiteSpace: 'nowrap' }}>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Logout */}
        <div style={{ padding: '12px 8px', borderTop: '1px solid #1a1a1e' }}>
          <button onClick={() => { localStorage.removeItem('managerToken'); localStorage.removeItem('managerInfo'); router.push('/manager-login'); }} style={{
            display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: collapsed ? '10px 12px' : '10px 12px',
            borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, background: 'transparent', color: '#ef4444',
            justifyContent: collapsed ? 'center' : 'flex-start',
          }}>
            <span>🚪</span>
            {!collapsed && <span>Déconnexion</span>}
          </button>
        </div>

        {/* Toggle */}
        {!isMobile && (
          <button onClick={() => setCollapsed(!collapsed)} style={{ position: 'absolute', right: -12, top: '50%', width: 24, height: 24, borderRadius: '50%', background: '#1a1a1e', border: '1px solid #27272a', color: '#71717a', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10 }}>
            {collapsed ? '›' : '‹'}
          </button>
        )}
      </aside>

      {/* Mobile overlay */}
      {isMobile && mobileOpen && <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 99 }} onClick={() => setMobileOpen(false)} />}

      {/* MAIN */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* HEADER */}
        <header style={{
          background: '#111113', borderBottom: '1px solid #1a1a1e', padding: '12px 20px',
          display: 'flex', alignItems: 'center', gap: 12, position: 'sticky', top: 0, zIndex: 50,
        }}>
          {isMobile && (
            <button onClick={() => setMobileOpen(true)} style={{ background: 'none', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', padding: 4 }}>☰</button>
          )}

          {/* Search */}
          <div style={{ flex: 1, maxWidth: 400, position: 'relative' }}>
            <div style={{ display: 'flex', alignItems: 'center', background: '#09090b', borderRadius: 8, padding: '8px 12px', border: '1px solid #1a1a1e', cursor: 'pointer' }} onClick={() => setShowSearch(true)}>
              <span style={{ fontSize: 14, color: '#52525b', marginRight: 8 }}>🔍</span>
              <span style={{ fontSize: 13, color: '#52525b' }}>Rechercher un agent, boutique ou code...</span>
              <span style={{ marginLeft: 'auto', fontSize: 10, color: '#27272a', background: '#1a1a1e', padding: '2px 6px', borderRadius: 4 }}>⌘K</span>
            </div>
          </div>

          {/* Right */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto' }}>
            <button style={{ background: '#1a1a1e', border: 'none', borderRadius: 8, width: 34, height: 34, color: '#71717a', cursor: 'pointer', fontSize: 16, position: 'relative' }}>
              🔔
              <span style={{ position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: '50%', background: '#ef4444' }} />
            </button>
            <button style={{ background: '#1a1a1e', border: 'none', borderRadius: 8, width: 34, height: 34, color: '#71717a', cursor: 'pointer', fontSize: 16 }}>💬</button>
            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg, #7c3aed, #a855f7)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 700, color: '#fff' }}>
              {manager?.firstName?.[0] || manager?.name?.[0] || 'A'}
            </div>
            <div style={{ display: isMobile ? 'none' : 'block' }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>{manager?.firstName} {manager?.lastName}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e' }} />
                <span style={{ fontSize: 11, color: '#22c55e' }}>En ligne</span>
              </div>
            </div>
          </div>
        </header>

        {/* CONTENT */}
        <main style={{ flex: 1, padding: isMobile ? 16 : 24, overflow: 'auto' }}>
          {children}
        </main>
      </div>

      {/* SEARCH MODAL */}
      {showSearch && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 80, zIndex: 200 }} onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); }}>
          <div style={{ background: '#111113', borderRadius: 12, width: '90%', maxWidth: 560, border: '1px solid #27272a', boxShadow: '0 20px 60px rgba(0,0,0,0.5)', overflow: 'hidden' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid #1a1a1e', gap: 10 }}>
              <span style={{ fontSize: 16, color: '#52525b' }}>🔍</span>
              <input ref={searchRef} type="text" placeholder="Rechercher un agent, boutique ou code..." value={searchQuery} onChange={e => handleSearch(e.target.value)} autoFocus style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 14 }} />
              <button onClick={() => { setShowSearch(false); setSearchResults([]); setSearchQuery(''); }} style={{ background: '#1a1a1e', border: 'none', color: '#71717a', borderRadius: 6, padding: '4px 10px', fontSize: 11, cursor: 'pointer' }}>ESC</button>
            </div>
            {searchResults.length > 0 && (
              <div style={{ maxHeight: 300, overflow: 'auto' }}>
                {searchResults.map((r: any, i: number) => (
                  <button key={i} onClick={() => { setShowSearch(false); router.push(r._type === 'agent' ? `/admin-manager/agents/${r._id}` : `/admin-manager/boutiques`); }} style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 16px', border: 'none', borderBottom: '1px solid #1a1a1e', background: 'transparent', cursor: 'pointer', textAlign: 'left', color: '#fff' }}>
                    <span style={{ fontSize: 20 }}>{r._type === 'agent' ? '👤' : '🏪'}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 500 }}>{r.name || r.storeName || r.code || r.shopId}</div>
                      <div style={{ fontSize: 11, color: '#71717a' }}>{r.code || r.phone} {r.city ? `· ${r.city}` : ''}</div>
                    </div>
                    <span style={{ fontSize: 10, color: '#52525b', background: '#1a1a1e', padding: '2px 8px', borderRadius: 4 }}>{r._type === 'agent' ? 'Agent' : 'Boutique'}</span>
                  </button>
                ))}
              </div>
            )}
            {searchQuery.length >= 2 && searchResults.length === 0 && (
              <div style={{ padding: 24, textAlign: 'center', color: '#52525b', fontSize: 13 }}>Aucun résultat</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
