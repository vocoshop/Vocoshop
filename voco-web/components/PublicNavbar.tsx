'use client';

import Link from 'next/link';
import { useState } from 'react';

export default function PublicNavbar({ active }: { active?: string }) {
  const [menuOpen, setMenuOpen] = useState(false);

  return (
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
      {/* Logo */}
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
        <span style={{
          fontSize: 22,
          fontWeight: 800,
          color: '#fafafa',
          letterSpacing: '-0.5px',
        }}>Voco<span style={{ color: '#a855f7' }}>shop</span></span>
      </Link>

      {/* Desktop nav */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 32,
      }}
        className="hide-mobile"
      >
        <Link href="/" style={{
          fontSize: 14,
          fontWeight: 500,
          color: active === 'home' ? '#a855f7' : '#a1a1aa',
          textDecoration: 'none',
          transition: 'color 0.2s',
        }}>Accueil</Link>
        <Link href="/login" style={{
          fontSize: 14,
          fontWeight: 500,
          color: active === 'login' ? '#a855f7' : '#a1a1aa',
          textDecoration: 'none',
          transition: 'color 0.2s',
        }}>Connexion</Link>
        <Link href="/devenir-agent" style={{
          padding: '10px 24px',
          borderRadius: 12,
          background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
          color: '#fff',
          fontSize: 14,
          fontWeight: 600,
          textDecoration: 'none',
          boxShadow: '0 0 20px #a855f730',
          transition: 'all 0.3s',
        }}>Devenir Agent</Link>
      </div>

      {/* Mobile hamburger */}
      <button
        onClick={() => setMenuOpen(!menuOpen)}
        className="show-mobile-only"
        style={{
          display: 'none',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: 8,
        }}
        aria-label="Menu"
      >
        <div style={{ width: 24, height: 2, background: '#fafafa', marginBottom: 5, transition: 'all 0.3s', transform: menuOpen ? 'rotate(45deg) translateY(7px)' : 'none' }} />
        <div style={{ width: 24, height: 2, background: '#fafafa', marginBottom: 5, opacity: menuOpen ? 0 : 1, transition: 'all 0.3s' }} />
        <div style={{ width: 24, height: 2, background: '#fafafa', transition: 'all 0.3s', transform: menuOpen ? 'rotate(-45deg) translateY(-7px)' : 'none' }} />
      </button>

      {/* Mobile menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed',
          top: 72,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(10, 10, 11, 0.95)',
          backdropFilter: 'blur(20px)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 32,
          zIndex: 99,
        }}>
          <Link href="/" onClick={() => setMenuOpen(false)} style={{ fontSize: 20, fontWeight: 600, color: '#fafafa', textDecoration: 'none' }}>Accueil</Link>
          <Link href="/login" onClick={() => setMenuOpen(false)} style={{ fontSize: 20, fontWeight: 600, color: '#fafafa', textDecoration: 'none' }}>Connexion</Link>
          <Link href="/devenir-agent" onClick={() => setMenuOpen(false)} style={{
            padding: '14px 32px',
            borderRadius: 14,
            background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
            color: '#fff',
            fontSize: 16,
            fontWeight: 600,
            textDecoration: 'none',
          }}>Devenir Agent</Link>
        </div>
      )}
    </nav>
  );
}
