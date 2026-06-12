'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    setIsMobile(window.innerWidth < 640);
    const handle = () => setIsMobile(window.innerWidth < 640);
    window.addEventListener('resize', handle);
    return () => window.removeEventListener('resize', handle);
  }, []);
  return isMobile;
}

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const isMobile = useIsMobile();
  const router = useRouter();

  useEffect(() => {
    const t = localStorage.getItem('adminToken');
    if (t) router.push('/super-admin/dashboard');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/admin/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Email ou mot de passe incorrect');
        setLoading(false);
        return;
      }

      localStorage.setItem('adminToken', data.token);
      localStorage.setItem('adminEmail', email);
      localStorage.setItem('adminInfo', JSON.stringify({
        email,
        name: data.name || email.split('@')[0],
        role: data.role || 'superadmin',
      }));

      router.push('/super-admin/dashboard');
    } catch (err) {
      setError('Erreur de connexion au serveur');
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.backgroundPattern}></div>
      <div style={{...styles.card, padding: isMobile ? '32px 24px' : '40px'}}>
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <div style={styles.logoIcon}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                <rect width="48" height="48" rx="12" fill="#6b4cdb"/>
                <path d="M14 24L21 31L34 17" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
          </div>
          <h1 style={styles.title}>Super Admin</h1>
          <p style={styles.subtitle}>VocoShop — Connexion sécurisée</p>
        </div>

        <form onSubmit={handleLogin} style={styles.form}>
          <div style={styles.fieldGroup}>
            <label style={styles.label}>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={styles.input}
              placeholder="superadmin@vocoshop.com"
              autoComplete="email"
              required
            />
          </div>

          <div style={styles.fieldGroup}>
            <label style={styles.label}>Mot de passe</label>
            <div style={styles.passwordWrap}>
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.inputPassword}
                placeholder="••••••••••••"
                autoComplete="current-password"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.togglePassword}
                tabIndex={-1}
              >
                {showPassword ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {error && (
            <div style={styles.errorContainer}>
              <span>{error}</span>
            </div>
          )}

          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? 'Connexion...' : 'Se connecter'}
          </button>
        </form>

        <div style={styles.footer}>
          <p style={styles.hint}>Accès réservé au propriétaire</p>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: '#f8f9fc',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  backgroundPattern: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    background: `
      radial-gradient(circle at 20% 80%, rgba(107, 76, 219, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 80% 20%, rgba(139, 92, 246, 0.08) 0%, transparent 50%),
      radial-gradient(circle at 50% 50%, rgba(107, 76, 219, 0.03) 0%, transparent 70%)
    `,
    pointerEvents: 'none',
  },
  card: {
    background: 'white',
    borderRadius: '24px',
    padding: '40px',
    width: '100%',
    maxWidth: '420px',
    boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.08)',
    position: 'relative',
    zIndex: 1,
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  logoContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '16px',
  },
  logoIcon: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#111827',
    margin: 0,
    marginBottom: '8px',
    letterSpacing: '-0.03em',
  },
  subtitle: {
    fontSize: '15px',
    color: '#6b7280',
    margin: 0,
    fontWeight: '500',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
  },
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '600',
    color: '#374151',
  },
  input: {
    padding: '14px 16px',
    borderRadius: '12px',
    border: '1.5px solid #e5e7eb',
    fontSize: '16px',
    color: '#1f2937',
    background: '#f9fafb',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'left',
    letterSpacing: 'normal',
  },
  passwordWrap: {
    position: 'relative',
    width: '100%',
  },
  inputPassword: {
    padding: '14px 48px 14px 16px',
    borderRadius: '12px',
    border: '1.5px solid #e5e7eb',
    fontSize: '16px',
    color: '#1f2937',
    background: '#f9fafb',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
    textAlign: 'left',
    letterSpacing: 'normal',
  },
  togglePassword: {
    position: 'absolute',
    right: '12px',
    top: '50%',
    transform: 'translateY(-50%)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '18px',
    padding: '4px',
  },
  errorContainer: {
    background: '#fef2f2',
    color: '#dc2626',
    padding: '12px 16px',
    borderRadius: '10px',
    fontSize: '14px',
    textAlign: 'center',
  },
  button: {
    padding: '16px 24px',
    background: 'linear-gradient(135deg, #6b4cdb 0%, #7c3aed 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '12px',
    fontSize: '16px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 4px 14px rgba(107, 76, 219, 0.3)',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center',
  },
  hint: {
    color: '#9ca3af',
    fontSize: '12px',
    margin: 0,
  },
};
