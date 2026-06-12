'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import PublicNavbar from '@/components/PublicNavbar';


const API_URL = process.env.NEXT_PUBLIC_API_URL;

const COUNTRIES = [
  { code: 'CG', name: 'Congo' },
  { code: 'CD', name: 'RDC' },
  { code: 'CM', name: 'Cameroun' },
  { code: 'GA', name: 'Gabon' },
  { code: 'CI', name: 'Côte d\'Ivoire' },
  { code: 'SN', name: 'Sénégal' },
  { code: 'FR', name: 'France' },
  { code: 'BE', name: 'Belgique' },
];

/* =====================================================
   SIGNUP PAGE — ULTRA PRO
===================================================== */
export default function DevenirAgent() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({
    country: 'CG',
    firstName: '',
    lastName: '',
    phone: '',
    gender: '',
    birthDate: '',
    city: '',
    idType: 'CNI',
    idNumber: '',
  });

  const update = (field: string, value: string) => setForm((p) => ({ ...p, [field]: value }));

  const handleSubmit = async () => {
    setError('');
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/agent/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur lors de l\'inscription');
      setSuccess(true);
    } catch (err: any) {
      console.error('Register error:', err);
      setError(err.message || 'Erreur inconnue');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '14px 16px',
    borderRadius: 12,
    border: '1px solid #27272a',
    background: '#0a0a0b',
    color: '#fafafa',
    fontSize: 15,
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  const labelStyle = {
    fontSize: 13,
    color: '#a1a1aa',
    marginBottom: 6,
    display: 'block' as const,
  };

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b', display: 'flex', flexDirection: 'column' }}>
      <PublicNavbar active="devenir-agent" />

      <div style={{
        flex: 1,
        padding: '100px 24px 60px',
        display: 'flex',
        justifyContent: 'center',
      }}>
        {/* FORM */}
        <div className="animate-fadeInRight" style={{ maxWidth: 460, width: '100%' }}>
          {success ? (
            /* SUCCESS */
            <div className="form-card" style={{
              padding: 48,
              borderRadius: 24,
              background: '#111113',
              border: '1px solid #22c55e30',
              textAlign: 'center',
            }}>
              <div style={{
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: '#22c55e15',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 36,
                margin: '0 auto 20px',
              }}>✓</div>
              <h2 style={{ fontSize: 24, fontWeight: 700, color: '#fafafa', marginBottom: 8 }}>
                Inscription envoyée !
              </h2>
              <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.6, marginBottom: 24 }}>
                Ton dossier est en cours de vérification. Tu recevras un SMS avec ton code agent dans les prochaines heures.
              </p>
              <Link href="/login" style={{
                display: 'inline-flex',
                padding: '14px 28px',
                borderRadius: 12,
                background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                color: '#fff',
                fontSize: 15,
                fontWeight: 600,
                textDecoration: 'none',
              }}>Aller à la connexion →</Link>
            </div>
          ) : (
            /* FORM */
            <div className="form-card" style={{
              padding: 40,
              borderRadius: 24,
              background: '#111113',
              border: '1px solid #1a1a1f',
            }}>
              {/* Header */}
              <div style={{ marginBottom: 28 }}>
                <h1 style={{ fontSize: 28, fontWeight: 800, color: '#fafafa', marginBottom: 4 }}>
                  Devenir Agent
                </h1>
                <p style={{ fontSize: 14, color: '#71717a' }}>
                  Étape {step} sur 3
                </p>
              </div>

              {/* Progress bar */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 32 }}>
                {[1, 2, 3].map((s) => (
                  <div key={s} style={{
                    flex: 1,
                    height: 4,
                    borderRadius: 2,
                    background: s <= step ? '#a855f7' : '#1a1a1f',
                    transition: 'background 0.3s',
                  }} />
                ))}
              </div>

              {/* STEP 1 — Infos personnelles */}
              {step === 1 && (
                <div className="animate-fadeIn">
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Prénom *</label>
                      <input
                        placeholder="Jean"
                        value={form.firstName}
                        onChange={(e) => update('firstName', e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                    <div>
                      <label style={labelStyle}>Nom *</label>
                      <input
                        placeholder="Dupont"
                        value={form.lastName}
                        onChange={(e) => update('lastName', e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Téléphone *</label>
                    <input
                      inputMode="text"
                      autoComplete="off"
                      placeholder="+242 6XX XXX XXX"
                      value={form.phone}
                      onChange={(e) => update('phone', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Pays *</label>
                    <select
                      value={form.country}
                      onChange={(e) => update('country', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      {COUNTRIES.map((c) => (
                        <option key={c.code} value={c.code} style={{ background: '#0a0a0b', color: '#fafafa' }}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Ville *</label>
                    <input
                      placeholder="Brazzaville"
                      value={form.city}
                      onChange={(e) => update('city', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {/* STEP 2 — Détails */}
              {step === 2 && (
                <div className="animate-fadeIn">
                  <div className="form-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <label style={labelStyle}>Genre</label>
                      <select
                        value={form.gender}
                        onChange={(e) => update('gender', e.target.value)}
                        style={{ ...inputStyle, cursor: 'pointer' }}
                      >
                        <option value="" style={{ background: '#0a0a0b' }}>Choisir</option>
                        <option value="M" style={{ background: '#0a0a0b' }}>Homme</option>
                        <option value="F" style={{ background: '#0a0a0b' }}>Femme</option>
                      </select>
                    </div>
                    <div>
                      <label style={labelStyle}>Date de naissance</label>
                      <input
                        type="text"
                        placeholder="JJ/MM/AAAA"
                        value={form.birthDate}
                        onChange={(e) => update('birthDate', e.target.value)}
                        style={inputStyle}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Type de pièce d'identité *</label>
                    <select
                      value={form.idType}
                      onChange={(e) => update('idType', e.target.value)}
                      style={{ ...inputStyle, cursor: 'pointer' }}
                    >
                      <option value="CNI" style={{ background: '#0a0a0b' }}>Carte Nationale d'Identité</option>
                      <option value="PASSEPORT" style={{ background: '#0a0a0b' }}>Passeport</option>
                      <option value="PERMIS" style={{ background: '#0a0a0b' }}>Permis de conduire</option>
                    </select>
                  </div>
                  <div style={{ marginTop: 12 }}>
                    <label style={labelStyle}>Numéro de la pièce *</label>
                    <input
                      placeholder="Ex: 00AB12345"
                      value={form.idNumber}
                      onChange={(e) => update('idNumber', e.target.value)}
                      style={inputStyle}
                    />
                  </div>
                </div>
              )}

              {/* STEP 3 — Confirmation */}
              {step === 3 && (
                <div className="animate-fadeIn">
                  <div style={{
                    padding: 20,
                    borderRadius: 16,
                    background: '#0a0a0b',
                    border: '1px solid #1a1a1f',
                    marginBottom: 20,
                  }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#fafafa', marginBottom: 12 }}>Récapitulatif</div>
                    {[
                      { label: 'Nom', value: `${form.firstName} ${form.lastName}` },
                      { label: 'Téléphone', value: form.phone },
                      { label: 'Ville', value: form.city },
                      { label: 'Pays', value: COUNTRIES.find((c) => c.code === form.country)?.name },
                      { label: 'Pièce', value: `${form.idType} — ${form.idNumber}` },
                    ].map((item, i) => (
                      <div key={i} style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: i < 4 ? '1px solid #1a1a1f' : 'none',
                      }}>
                        <span style={{ fontSize: 13, color: '#71717a' }}>{item.label}</span>
                        <span style={{ fontSize: 13, color: '#fafafa', fontWeight: 500 }}>{item.value}</span>
                      </div>
                    ))}
                  </div>

                  <div style={{
                    padding: 16,
                    borderRadius: 12,
                    background: '#a855f708',
                    border: '1px solid #a855f720',
                    marginBottom: 16,
                  }}>
                    <p style={{ fontSize: 12, color: '#a1a1aa', lineHeight: 1.5 }}>
                      En soumettant, tu acceptes les conditions d'utilisation de Vocoshop. Ton dossier sera vérifié par notre équipe.
                    </p>
                  </div>

                  {error && <div style={{ color: '#ef4444', fontSize: 13, marginBottom: 12 }}>{error}</div>}
                </div>
              )}

              {/* Navigation */}
              <div style={{ display: 'flex', gap: 12, marginTop: 24 }}>
                {step > 1 && (
                  <button
                    onClick={() => setStep(step - 1)}
                    style={{
                      flex: 1,
                      padding: '14px',
                      borderRadius: 12,
                      border: '1px solid #27272a',
                      background: 'transparent',
                      color: '#fafafa',
                      fontSize: 15,
                      fontWeight: 500,
                      cursor: 'pointer',
                    }}
                  >← Retour</button>
                )}
                <button
                  onClick={() => {
                    if (step === 1 && (!form.firstName || !form.lastName || !form.phone || !form.city)) {
                      setError('Remplis tous les champs obligatoires');
                      return;
                    }
                    if (step === 2 && !form.idNumber) {
                      setError('Numéro de pièce requis');
                      return;
                    }
                    setError('');
                    if (step < 3) setStep(step + 1);
                    else handleSubmit();
                  }}
                  disabled={loading}
                  style={{
                    flex: 2,
                    padding: '14px',
                    borderRadius: 12,
                    border: 'none',
                    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    color: '#fff',
                    fontSize: 15,
                    fontWeight: 600,
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Envoi...' : step === 3 ? 'Envoyer ma candidature' : 'Suivant →'}
                </button>
              </div>
            </div>
          )}

          {/* Login link */}
          {!success && (
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <span style={{ fontSize: 14, color: '#71717a' }}>Déjà un compte ? </span>
              <Link href="/login" style={{ fontSize: 14, color: '#a855f7', fontWeight: 600, textDecoration: 'none' }}>
                Se connecter
              </Link>
            </div>
          )}
        </div>
      </div>

    </div>
  );
}
