'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

export default function PublicNavbar({ active }: { active?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    if (menuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [menuOpen]);

  const menuItems = [
    { label: 'Accueil', href: '/', key: 'home' },
    { label: 'Connexion', href: '/login', key: 'login' },
    { label: 'Devenir Agent', href: '/devenir-agent', key: 'devenir-agent' },
    { label: 'Comment ça marche', href: '/#comment-ca-marche', key: 'comment' },
    { label: 'Fonctionnalités', href: '/#fonctionnalites', key: 'features' },
    { label: 'Contact', href: '/#contact', key: 'contact' },
  ];

  return (
    <>
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 100,
        padding: '0 24px',
        height: 72,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: 'rgba(10, 10, 11, 0.8)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(168, 85, 247, 0.08)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 18,
            fontWeight: 800,
            color: '#fff',
            boxShadow: '0 0 20px #a855f740',
          }}>V</div>
          <span style={{ fontSize: 22, fontWeight: 800, color: '#fafafa', letterSpacing: '-0.5px' }}>
            Voco<span style={{ color: '#a855f7' }}>shop</span>
          </span>
        </Link>

        <div className="hide-mobile" style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <Link href="/" style={{ fontSize: 14, fontWeight: 500, color: active === 'home' ? '#a855f7' : '#a1a1aa', textDecoration: 'none', transition: 'color 0.2s' }}>Accueil</Link>
          <Link href="/login" style={{ fontSize: 14, fontWeight: 500, color: active === 'login' ? '#a855f7' : '#a1a1aa', textDecoration: 'none', transition: 'color 0.2s' }}>Connexion</Link>
          <Link href="/devenir-agent" style={{ padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', color: '#fff', fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 0 20px #a855f730', transition: 'all 0.3s' }}>Devenir Agent</Link>
        </div>

        <button
          onClick={() => setMenuOpen(true)}
          className="show-mobile-only"
          style={{ display: 'none', background: 'none', border: 'none', cursor: 'pointer', padding: 8 }}
          aria-label="Menu"
        >
          <div style={{ width: 24, height: 2, background: '#fafafa', marginBottom: 5 }} />
          <div style={{ width: 24, height: 2, background: '#fafafa', marginBottom: 5 }} />
          <div style={{ width: 24, height: 2, background: '#fafafa' }} />
        </button>
      </nav>

      {/* Overlay */}
      <div
        onClick={() => setMenuOpen(false)}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0, 0, 0, 0.6)',
          backdropFilter: 'blur(4px)',
          WebkitBackdropFilter: 'blur(4px)',
          zIndex: 200,
          opacity: menuOpen ? 1 : 0,
          pointerEvents: menuOpen ? 'auto' : 'none',
          transition: 'opacity 0.3s ease',
        }}
      />

      {/* Drawer */}
      <div style={{
        position: 'fixed',
        top: 0,
        right: 0,
        bottom: 0,
        width: '85%',
        maxWidth: 380,
        background: '#0f0f13',
        borderLeft: '1px solid #1a1a1f',
        zIndex: 201,
        transform: menuOpen ? 'translateX(0)' : 'translateX(100%)',
        transition: 'transform 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: menuOpen ? '-10px 0 40px rgba(0, 0, 0, 0.5)' : 'none',
      }}>
        {/* Drawer Header */}
        <div style={{ padding: '24px 24px 20px', borderBottom: '1px solid #1a1a1f', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 40,
              height: 40,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 20,
              fontWeight: 800,
              color: '#fff',
            }}>V</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 700, color: '#fafafa' }}>Vocoshop</div>
              <div style={{ fontSize: 11, color: '#71717a' }}>Plateforme de gestion commerciale</div>
            </div>
          </div>
          <button
            onClick={() => setMenuOpen(false)}
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              border: '1px solid #27272a',
              background: '#1a1a1f',
              color: '#fafafa',
              fontSize: 20,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background 0.2s',
            }}
          >×</button>
        </div>

        {/* Drawer Items */}
        <div style={{ flex: 1, padding: '16px 24px', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {menuItems.map((item) => (
            <Link
              key={item.key}
              href={item.href}
              onClick={() => setMenuOpen(false)}
              style={{
                padding: '14px 16px',
                borderRadius: 12,
                fontSize: 16,
                fontWeight: 500,
                color: active === item.key ? '#a855f7' : '#d4d4d8',
                textDecoration: 'none',
                background: active === item.key ? '#a855f710' : 'transparent',
                transition: 'all 0.2s',
              }}
            >{item.label}</Link>
          ))}
        </div>

        {/* Drawer CTA */}
        <div style={{ padding: '16px 24px 32px' }}>
          <Link
            href="/devenir-agent"
            onClick={() => setMenuOpen(false)}
            style={{
              display: 'block',
              width: '100%',
              padding: '16px',
              borderRadius: 14,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              color: '#fff',
              fontSize: 16,
              fontWeight: 700,
              textAlign: 'center',
              textDecoration: 'none',
              boxShadow: '0 4px 20px #a855f740',
            }}
          >Devenir Agent</Link>
        </div>
      </div>
    </>
  );
}
