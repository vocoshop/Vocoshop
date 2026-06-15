'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

export default function Login() {
  const router = useRouter();
  const [step, setStep] = useState<'identifier' | 'password' | 'authCode' | 'setPassword' | 'forgot'>('identifier');
  const [codeOrPhone, setCodeOrPhone] = useState('');
  const [password, setPassword] = useState('');
  const [authCode, setAuthCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [forgotPhone, setForgotPhone] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [tempAgent, setTempAgent] = useState<any>(null);
  const [sendingOtp, setSendingOtp] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('agentToken');
    if (token) router.push('/agent/dashboard');
  }, []);

  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!codeOrPhone.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/agent/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeOrPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Agent introuvable');
      setTempAgent(data.agent);
      if (data.requiresPasswordSetup) {
        setSendingOtp(false);
        setStep('authCode');
      } else if (data.requiresPassword) {
        setStep('password');
      } else if (data.token) {
        localStorage.setItem('agentToken', data.token);
        localStorage.setItem('agentData', JSON.stringify(data.agent));
        document.cookie = `agentToken=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        router.push('/agent/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!password) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/agent/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codeOrPhone, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Mot de passe incorrect');
      if (data.token) {
        localStorage.setItem('agentToken', data.token);
        localStorage.setItem('agentData', JSON.stringify(data.agent));
        document.cookie = `agentToken=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        router.push('/agent/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleAuthCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/agent/auth/verify-auth-code`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: tempAgent?.id, code: authCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Code invalide');
      if (data.requiresPasswordSetup) {
        setStep('setPassword');
        setAuthCode(authCode);
      } else if (data.token) {
        localStorage.setItem('agentToken', data.token);
        localStorage.setItem('agentData', JSON.stringify(data.agent));
        document.cookie = `agentToken=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        router.push('/agent/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Code invalide');
    } finally {
      setLoading(false);
    }
  };

  const handleSetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Le mot de passe doit faire au moins 6 caractères');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/agent/auth/set-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: tempAgent?.id, newPassword, authCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      if (data.token) {
        localStorage.setItem('agentToken', data.token);
        localStorage.setItem('agentData', JSON.stringify(data.agent));
        document.cookie = `agentToken=${data.token}; path=/; max-age=${7 * 24 * 60 * 60}; SameSite=Lax`;
        router.push('/agent/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/agent/auth/forgot-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: forgotPhone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setForgotMsg(data.message || 'Un nouveau mot de passe a été envoyé par SMS.');
    } catch (err: any) {
      setError(err.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', flexDirection: 'column' }}>
      <PublicNavbar active="login" />
      <div style={{ flex: 1, padding: '100px 24px 60px', display: 'flex', justifyContent: 'center' }}>
        <div className="animate-fadeInRight" style={{ maxWidth: 420, width: '100%' }}>
          <div className="form-card" style={{ padding: 40, borderRadius: 24, background: '#111113', border: '1px solid #1a1a1f' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
              <div style={{ width: 40, height: 40, borderRadius: 12, background: 'linear-gradient(135deg, #a855f7, #7c3aed)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, fontWeight: 800, color: '#fff' }}>V</div>
              <div>
                <div style={{ fontSize: 20, fontWeight: 700, color: '#fafafa' }}>Connexion</div>
                <div style={{ fontSize: 12, color: '#71717a' }}>Espace Agent Vocoshop</div>
              </div>
            </div>

            {/* STEP: IDENTIFIER (code ou téléphone) */}
            {step === 'identifier' && (
              <form onSubmit={handleIdentify}>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Code agent ou téléphone</label>
                  <input
                    type="text"
                    placeholder="AG-XXXX-XXXX ou +242..."
                    value={codeOrPhone}
                    onChange={(e) => setCodeOrPhone(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #27272a', background: '#0a0a0b', color: '#fafafa', fontSize: 15, outline: 'none' }}
                    autoFocus
                  />
                </div>
                {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <button
                  type="submit"
                  disabled={!codeOrPhone.trim() || loading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: !codeOrPhone.trim() ? '#27272a' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: '#fff', fontSize: 15, fontWeight: 600,
                    cursor: !codeOrPhone.trim() ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Vérification...' : 'Continuer'}
                </button>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <button type="button" onClick={() => { setStep('forgot'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 13, cursor: 'pointer' }}>
                    Mot de passe oublié ?
                  </button>
                </div>
              </form>
            )}

            {/* STEP: PASSWORD (agent identifié, mot de passe requis) */}
            {step === 'password' && (
              <form onSubmit={handlePasswordLogin}>
                <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 20, lineHeight: 1.5 }}>
                  {tempAgent?.firstName
                    ? `Bonjour ${tempAgent.firstName}, saisis ton mot de passe.`
                    : 'Saisis ton mot de passe.'}
                </p>
                <div style={{ marginBottom: 20 }}>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      style={{ width: '100%', padding: '14px 48px 14px 16px', borderRadius: 12, border: '1px solid #27272a', background: '#0a0a0b', color: '#fafafa', fontSize: 15, outline: 'none' }}
                      autoFocus
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)}
                      style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#71717a', cursor: 'pointer', fontSize: 18 }}>
                      {showPassword ? '🙈' : '👁️'}
                    </button>
                  </div>
                </div>
                {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <button
                  type="submit"
                  disabled={!password || loading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: !password ? '#27272a' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: '#fff', fontSize: 15, fontWeight: 600,
                    cursor: !password ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Connexion...' : 'Se connecter'}
                </button>
                <div style={{ marginTop: 16, textAlign: 'center', display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <button type="button" onClick={() => { setStep('identifier'); setError(''); setPassword(''); }}
                    style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: 13, cursor: 'pointer' }}>
                    ← Changer d'identifiant
                  </button>
                  <button type="button" onClick={() => { setStep('forgot'); setError(''); }}
                    style={{ background: 'none', border: 'none', color: '#71717a', fontSize: 13, cursor: 'pointer' }}>
                    Mot de passe oublié ?
                  </button>
                </div>
              </form>
            )}

            {/* STEP: OTP / AUTH CODE */}
            {step === 'authCode' && (
              <form onSubmit={handleAuthCode}>
                <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 20, lineHeight: 1.5 }}>
                  {tempAgent?.firstName
                    ? `Un code a été envoyé par SMS à ${tempAgent.firstName}.`
                    : 'Un code a été envoyé par SMS.'}
                  <br />Saisis le code à 6 chiffres.
                </p>
                <input
                  type="text"
                  placeholder="Code à 6 chiffres"
                  value={authCode}
                  onChange={(e) => setAuthCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #27272a', background: '#0a0a0b', color: '#fafafa', fontSize: 24, fontWeight: 700, letterSpacing: 8, textAlign: 'center', outline: 'none', marginBottom: 16 }}
                  autoFocus
                />
                {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <button
                  type="submit"
                  disabled={authCode.length < 6 || loading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: authCode.length < 6 ? '#27272a' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: '#fff', fontSize: 15, fontWeight: 600,
                    cursor: authCode.length < 6 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Vérification...' : 'Vérifier'}
                </button>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <button type="button" onClick={() => { setStep('identifier'); setError(''); setAuthCode(''); }}
                    style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: 13, cursor: 'pointer' }}>
                    ← Changer d'identifiant
                  </button>
                </div>
              </form>
            )}

            {/* STEP: SET PASSWORD */}
            {step === 'setPassword' && (
              <form onSubmit={handleSetPassword}>
                <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 20, lineHeight: 1.5 }}>
                  Crée ton mot de passe pour accéder à ton espace agent.
                </p>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 6, display: 'block' }}>Nouveau mot de passe</label>
                  <input
                    type="password"
                    placeholder="Minimum 6 caractères"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #27272a', background: '#0a0a0b', color: '#fafafa', fontSize: 15, outline: 'none' }}
                    autoFocus
                  />
                </div>
                {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
                <button
                  type="submit"
                  disabled={newPassword.length < 6 || loading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: newPassword.length < 6 ? '#27272a' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: '#fff', fontSize: 15, fontWeight: 600,
                    cursor: newPassword.length < 6 ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Création...' : 'Créer mon mot de passe'}
                </button>
              </form>
            )}

            {/* STEP: FORGOT */}
            {step === 'forgot' && (
              <form onSubmit={handleForgot}>
                <p style={{ fontSize: 13, color: '#a1a1aa', marginBottom: 20, lineHeight: 1.5 }}>
                  Entrez votre numéro de téléphone. Un nouveau mot de passe vous sera envoyé par SMS.
                </p>
                <input
                  type="tel"
                  placeholder="+242 6XX XXX XXX"
                  value={forgotPhone}
                  onChange={(e) => setForgotPhone(e.target.value)}
                  style={{ width: '100%', padding: '14px 16px', borderRadius: 12, border: '1px solid #27272a', background: '#0a0a0b', color: '#fafafa', fontSize: 15, outline: 'none', marginBottom: 16 }}
                  autoFocus
                />
                {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
                {forgotMsg && <div style={{ color: '#22c55e', fontSize: 13, marginBottom: 12 }}>{forgotMsg}</div>}
                <button
                  type="submit"
                  disabled={!forgotPhone || loading}
                  style={{
                    width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                    background: !forgotPhone ? '#27272a' : 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: '#fff', fontSize: 15, fontWeight: 600,
                    cursor: !forgotPhone ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? 'Envoi...' : 'Envoyer le nouveau mot de passe'}
                </button>
                <div style={{ marginTop: 16, textAlign: 'center' }}>
                  <button type="button" onClick={() => { setStep('identifier'); setError(''); setForgotMsg(''); }}
                    style={{ background: 'none', border: 'none', color: '#a855f7', fontSize: 13, cursor: 'pointer' }}>
                    ← Retour à la connexion
                  </button>
                </div>
              </form>
            )}
          </div>

          <div style={{ textAlign: 'center', marginTop: 24 }}>
            <span style={{ fontSize: 14, color: '#71717a' }}>Pas encore de compte ? </span>
            <Link href="/devenir-agent" style={{ fontSize: 14, color: '#a855f7', fontWeight: 600, textDecoration: 'none' }}>
              Devenir Agent
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
