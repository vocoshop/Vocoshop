'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import PublicNavbar from '@/components/PublicNavbar';
import PublicFooter from '@/components/PublicFooter';
import PhoneMockup from '@/components/PhoneMockup';
import HomeScreenMockup from '@/components/HomeScreenMockup';

/* =====================================================
   SPLASH SCREEN — VOCOSHOP en grand
====================================================== */
function Splash({ onComplete }: { onComplete: () => void }) {
  const [phase, setPhase] = useState<'enter' | 'hold' | 'exit'>('enter');

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('hold'), 600);
    const t2 = setTimeout(() => setPhase('exit'), 2200);
    const t3 = setTimeout(() => onComplete(), 3000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999, background: '#0a0a0b',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      opacity: phase === 'exit' ? 0 : 1, transition: 'opacity 0.8s ease',
      pointerEvents: phase === 'exit' ? 'none' : 'all',
    }}>
      <div className="animate-glowPulse" style={{
        position: 'absolute', width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, #a855f718 0%, transparent 70%)',
        filter: 'blur(80px)', pointerEvents: 'none',
      }} />
      <div style={{
        width: 72, height: 72, borderRadius: 20,
        background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 36, fontWeight: 800, color: '#fff', marginBottom: 24,
        boxShadow: '0 0 40px #a855f750',
        transform: phase === 'enter' ? 'scale(0.5) translateY(20px)' : 'scale(1) translateY(0)',
        opacity: phase === 'enter' ? 0 : 1, transition: 'all 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
      }}>V</div>
      <h1 style={{
        fontSize: 72, fontWeight: 900, letterSpacing: '-3px',
        background: 'linear-gradient(135deg, #fafafa 0%, #a855f7 60%, #7c3aed 100%)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text',
        transform: phase === 'enter' ? 'translateY(30px)' : 'translateY(0)',
        opacity: phase === 'enter' ? 0 : 1, transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: '0.15s', textAlign: 'center',
      }}>VOCOSHOP</h1>
      <div style={{
        width: phase === 'hold' ? 80 : 0, height: 2,
        background: 'linear-gradient(90deg, transparent, #a855f7, transparent)',
        margin: '16px 0', transition: 'width 0.6s ease', transitionDelay: '0.3s',
      }} />
      <p style={{
        fontSize: 18, color: '#a1a1aa', fontWeight: 400, letterSpacing: '0.5px',
        transform: phase === 'enter' ? 'translateY(20px)' : 'translateY(0)',
        opacity: phase === 'enter' ? 0 : 1, transition: 'all 0.7s cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: '0.35s', textAlign: 'center', maxWidth: 400, lineHeight: 1.5,
      }}>
        Rejoins la grande communauté des agents qui transforment le commerce local
      </p>
      <div style={{
        display: 'flex', gap: 6, marginTop: 32,
        opacity: phase === 'hold' ? 1 : 0, transition: 'opacity 0.4s ease',
      }}>
        {[0, 1, 2].map((i) => (
          <div key={i} style={{
            width: 6, height: 6, borderRadius: '50%', background: '#a855f7',
            animation: 'pulse 1.4s ease-in-out infinite', animationDelay: `${i * 0.2}s`,
          }} />
        ))}
      </div>
    </div>
  );
}

/* =====================================================
   ANIMATED COUNTER
====================================================== */
function Counter({ target, suffix = '' }: { target: number; suffix?: string }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const timer = setTimeout(() => {
      const step = (ts: number) => {
        if (!start) start = ts;
        const progress = Math.min((ts - start) / 2000, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        setVal(Math.round(eased * target));
        if (progress < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }, 200);
    return () => clearTimeout(timer);
  }, [target]);
  return <>{val.toLocaleString('fr-FR')}{suffix}</>;
}

/* =====================================================
   PARTICLES — fond animé
====================================================== */
function Particles() {
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {[...Array(6)].map((_, i) => (
        <div key={i} style={{
          position: 'absolute', width: 4 + Math.random() * 4, height: 4 + Math.random() * 4,
          borderRadius: '50%', background: '#a855f7', opacity: 0.15,
          left: `${10 + Math.random() * 80}%`, bottom: '-10px',
          animation: `particleFloat ${8 + Math.random() * 8}s linear infinite`,
          animationDelay: `${i * 2}s`,
        }} />
      ))}
    </div>
  );
}

/* =====================================================
   SECTION TITLES — réutilisable
====================================================== */
function SectionHeader({ badge, title, subtitle }: { badge?: string; title: string; subtitle?: string }) {
  return (
    <div className="animate-fadeInUp" style={{ textAlign: 'center', marginBottom: 56 }}>
      {badge && (
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 14px',
          borderRadius: 100, background: '#a855f710', border: '1px solid #a855f720',
          marginBottom: 20, fontSize: 12, color: '#a855f7', fontWeight: 600,
          textTransform: 'uppercase', letterSpacing: '0.5px',
        }}>{badge}</div>
      )}
      <h2 className="section-title" style={{
        fontSize: 36, fontWeight: 800, color: '#fafafa', letterSpacing: '-1px', marginBottom: 12,
      }}>{title}</h2>
      {subtitle && (
        <p className="section-subtitle" style={{ fontSize: 16, color: '#a1a1aa', maxWidth: 560, margin: '0 auto' }}>
          {subtitle}
        </p>
      )}
    </div>
  );
}

/* =====================================================
   HOME PAGE
====================================================== */
export default function Home() {
  const [scrollY, setScrollY] = useState(0);
  const [showSplash, setShowSplash] = useState(true);

  useEffect(() => {
    const handle = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, []);

  return (
    <div style={{ minHeight: '100vh', background: '#0a0a0b' }}>
      {showSplash && <Splash onComplete={() => setShowSplash(false)} />}
      <PublicNavbar active="home" />

      {/* =====================================================
          SECTION 1 — HERO
      ====================================================== */}
      <section className="hero-section" style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '100px 24px 60px', position: 'relative', overflow: 'hidden',
      }}>
        <Particles />
        <div className="animate-glowPulse" style={{
          position: 'absolute', top: '10%', left: '15%', width: 400, height: 400,
          borderRadius: '50%', background: 'radial-gradient(circle, #a855f715 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <div className="animate-glowPulse" style={{
          position: 'absolute', bottom: '10%', right: '10%', width: 300, height: 300,
          borderRadius: '50%', background: 'radial-gradient(circle, #7c3aed15 0%, transparent 70%)',
          filter: 'blur(60px)', pointerEvents: 'none', animationDelay: '2s',
        }} />

        <div className="grid-2" style={{ maxWidth: 1100, width: '100%', position: 'relative', zIndex: 1 }}>
          {/* LEFT — TEXT */}
          <div className="animate-fadeInLeft" style={{ maxWidth: 520 }}>
            <div className="animate-fadeInDown" style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 16px',
              borderRadius: 100, background: '#a855f710', border: '1px solid #a855f725', marginBottom: 28,
            }}>
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', boxShadow: '0 0 8px #22c55e80' }} />
              <span style={{ fontSize: 13, color: '#a1a1aa', fontWeight: 500 }}>Disponible à Brazzaville</span>
            </div>

            <h1 className="hero-title" style={{
              fontSize: 52, fontWeight: 800, lineHeight: 1.1, color: '#fafafa',
              letterSpacing: '-1.5px', marginBottom: 20,
            }}>
              Deviens Agent{' '}
              <span className="gradient-text">Vocoshop</span>
            </h1>

            <p className="hero-subtitle" style={{
              fontSize: 18, color: '#a1a1aa', lineHeight: 1.6, marginBottom: 12, maxWidth: 460,
            }}>
              Accompagne les commerçants dans leur transformation digitale et développe tes revenus grâce au réseau Vocoshop.
            </p>
            <p style={{ fontSize: 15, color: '#71717a', lineHeight: 1.6, marginBottom: 36, maxWidth: 440 }}>
              Installe des boutiques, accompagne leur croissance et bénéficie de commissions récurrentes.
            </p>

            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              <Link href="/devenir-agent" className="cta-btn" style={{
                padding: '16px 32px', borderRadius: 14,
                background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                color: '#fff', fontSize: 16, fontWeight: 600, textDecoration: 'none',
                boxShadow: '0 0 30px #a855f730', transition: 'all 0.3s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 0 40px #a855f750'; }}
                onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 30px #a855f730'; }}
              >Devenir Agent</Link>
              <Link href="/login" style={{
                padding: '16px 32px', borderRadius: 14, background: 'transparent',
                color: '#fafafa', fontSize: 16, fontWeight: 600, textDecoration: 'none',
                border: '1px solid #27272a', transition: 'all 0.3s',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a855f750'; e.currentTarget.style.background = '#a855f708'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.background = 'transparent'; }}
              >Connexion</Link>
            </div>
          </div>

          {/* RIGHT — PHONE MOCKUP */}
          <div className="animate-fadeInRight delay-300" style={{
            display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative',
          }}>
            <div className="animate-glowPulse" style={{
              position: 'absolute', width: 320, height: 320, borderRadius: '50%',
              border: '1px solid #a855f715', pointerEvents: 'none',
            }} />
            <div className="animate-glowPulse" style={{
              position: 'absolute', width: 400, height: 400, borderRadius: '50%',
              border: '1px solid #a855f708', pointerEvents: 'none', animationDelay: '1s',
            }} />
            <div style={{ transform: `translateY(${scrollY * 0.05}px)`, transition: 'transform 0.1s linear' }}>
              <PhoneMockup>
                <HomeScreenMockup />
              </PhoneMockup>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================
          SECTION 2 — POURQUOI DEVENIR AGENT
      ====================================================== */}
      <section style={{ padding: '100px 24px', position: 'relative' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHeader
            title="Pourquoi rejoindre Vocoshop ?"
            subtitle="Un modèle simple : tu installes, tu accompagnes, tu gagnes."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {[
              { icon: '💰', title: 'Revenus récurrents', desc: 'Gagne des commissions sur les boutiques que tu installes et accompagnes.' },
              { icon: '📈', title: 'Développe ton portefeuille', desc: 'Construis un réseau de commerçants dans ton quartier, ta ville ou ta région.' },
              { icon: '🤝', title: 'Impact local', desc: 'Aide les commerçants à mieux gérer leur activité et à accéder à de nouvelles opportunités.' },
            ].map((card, i) => (
              <div key={i} className={`animate-fadeInUp delay-${(i + 1) * 100}`} style={{
                padding: 32, borderRadius: 20, background: '#111113', border: '1px solid #1a1a1f',
                transition: 'all 0.4s ease', cursor: 'default',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.border = '#a855f730'; e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = '0 20px 40px -15px #a855f715'; }}
                onMouseLeave={(e) => { e.currentTarget.style.border = '#1a1a1f'; e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}
              >
                <div style={{
                  width: 52, height: 52, borderRadius: 14, background: '#a855f715',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 24, marginBottom: 20,
                }}>{card.icon}</div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: '#fafafa', marginBottom: 8 }}>{card.title}</h3>
                <p style={{ fontSize: 14, color: '#a1a1aa', lineHeight: 1.6 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          SECTION 3 — CE QUE VOCOSHOP APPORTE AUX COMMERÇANTS
      ====================================================== */}
      <section style={{ padding: '100px 24px', background: '#111113', borderTop: '1px solid #1a1a1f', borderBottom: '1px solid #1a1a1f' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <SectionHeader
            badge="Pour les commerçants"
            title="Une solution pensée pour les commerçants africains"
            subtitle="L'agent propose, le commerçant profite. Voici ce que Vocoshop leur offre."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 20 }}>
            {[
              { icon: '📷', title: 'OCR Intelligent', desc: 'Une simple photo du cahier permet d\'importer automatiquement les ventes et les stocks.' },
              { icon: '📦', title: 'Gestion des stocks', desc: 'Suivi des entrées, sorties et alertes de rupture.' },
              { icon: '📊', title: 'Bilans automatiques', desc: 'Les performances de la boutique sont calculées automatiquement.' },
              { icon: '🏦', title: 'Opportunités de financement', desc: 'Les commerçants pourront accéder à des partenaires financiers grâce à leurs données d\'activité.' },
              { icon: '🚚', title: 'Gestion des fournisseurs', desc: 'Centralisation des fournisseurs et simplification des commandes.' },
              { icon: '📱', title: 'Application mobile', desc: 'Toutes les informations de la boutique dans la poche du commerçant.' },
            ].map((card, i) => (
              <div key={i} className={`animate-fadeInUp delay-${(i + 1) * 100}`} style={{
                padding: 28, borderRadius: 16, background: '#0a0a0b', border: '1px solid #1a1a1f',
                transition: 'all 0.3s ease',
              }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a855f725'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#1a1a1f'; e.currentTarget.style.transform = 'translateY(0)'; }}
              >
                <div style={{
                  width: 44, height: 44, borderRadius: 12, background: '#a855f712',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, marginBottom: 16,
                }}>{card.icon}</div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#fafafa', marginBottom: 6 }}>{card.title}</h3>
                <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.6 }}>{card.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          SECTION 4 — COMMENT ÇA FONCTIONNE
      ====================================================== */}
      <section style={{ padding: '100px 24px', position: 'relative' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <SectionHeader
            title="Comment fonctionne Vocoshop ?"
            subtitle="Un processus simple en 4 étapes."
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 24, position: 'relative' }}>
            {[
              { num: '01', title: 'L\'agent installe la boutique', desc: 'Crée le compte du commerçant et configure son application.' },
              { num: '02', title: 'Le commerçant utilise l\'app', desc: 'Il scanne son cahier ou saisit ses ventes directement.' },
              { num: '03', title: 'Vocoshop transforme les données', desc: 'Les écritures deviennent des indicateurs clairs et exploitables.' },
              { num: '04', title: 'Le commerçant progresse', desc: 'Il améliore sa gestion et accède à de nouvelles opportunités.' },
            ].map((step, i) => (
              <div key={i} className={`animate-fadeInUp delay-${(i + 1) * 100}`} style={{
                padding: 28, borderRadius: 16, background: '#111113', border: '1px solid #1a1a1f',
                textAlign: 'center', position: 'relative',
              }}>
                <div style={{
                  fontSize: 36, fontWeight: 900, color: '#a855f720', marginBottom: 12, lineHeight: 1,
                }}>{step.num}</div>
                <h3 style={{ fontSize: 15, fontWeight: 700, color: '#fafafa', marginBottom: 8 }}>{step.title}</h3>
                <p style={{ fontSize: 13, color: '#a1a1aa', lineHeight: 1.5 }}>{step.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          SECTION 5 — STATISTIQUES
      ====================================================== */}
      <section className="section-padding" style={{
        padding: '80px 24px', background: '#111113', borderTop: '1px solid #1a1a1f', borderBottom: '1px solid #1a1a1f',
      }}>
        <div style={{ maxWidth: 1000, margin: '0 auto', textAlign: 'center' }}>
          <h2 className="gradient-text section-title" style={{
            fontSize: 40, fontWeight: 800, letterSpacing: '-1px', marginBottom: 12,
          }}>Vocoshop en chiffres</h2>
          <p className="section-subtitle" style={{ fontSize: 16, color: '#a1a1aa', marginBottom: 48 }}>
            Des indicateurs qui reflètent la croissance du réseau.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 32 }}>
            {[
              { val: 12, suffix: '+', label: 'Agents actifs' },
              { val: 45, suffix: '+', label: 'Boutiques connectées' },
              { val: 2400, suffix: '+', label: 'Scans OCR' },
              { val: 8500, suffix: '+', label: 'Ventes enregistrées' },
              { val: 12500000, suffix: '', label: 'XAF suivis' },
              { val: 98, suffix: '%', label: 'Satisfaction' },
            ].map((s, i) => (
              <div key={i} className="animate-fadeInUp" style={{ animationDelay: `${i * 100}ms` }}>
                <div className="stat-number" style={{ fontSize: 32, fontWeight: 800, color: '#a855f7' }}>
                  <Counter target={s.val} suffix={s.suffix} />
                </div>
                <div style={{ fontSize: 12, color: '#71717a', marginTop: 4 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          SECTION 6 — TÉMOIGNAGES
      ====================================================== */}
      <section style={{ padding: '100px 24px', position: 'relative' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <SectionHeader
            badge="Témoignages"
            title="Ils nous font confiance"
          />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: 20 }}>
            {[
              {
                quote: 'Grâce à Vocoshop j\'accompagne plusieurs commerçants de mon quartier. Mes commissions sont régulières et je vois l\'impact concret de mon travail.',
                author: 'Agent Vocoshop',
                role: 'Brazzaville',
                icon: '👤',
              },
              {
                quote: 'Je n\'ai plus besoin de refaire mes calculs à la main. Je scanne mon cahier le soir et le lendemain je sais exactement ce que j\'ai vendu.',
                author: 'Commerçant',
                role: 'Marché Total',
                icon: '🏪',
              },
            ].map((t, i) => (
              <div key={i} className={`animate-fadeInUp delay-${(i + 1) * 100}`} style={{
                padding: 32, borderRadius: 20, background: '#111113', border: '1px solid #1a1a1f',
                position: 'relative',
              }}>
                <div style={{ fontSize: 36, color: '#a855f730', marginBottom: 16, lineHeight: 1 }}>&ldquo;</div>
                <p style={{ fontSize: 15, color: '#d4d4d8', lineHeight: 1.7, marginBottom: 24, fontStyle: 'italic' }}>
                  {t.quote}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{
                    width: 40, height: 40, borderRadius: 10,
                    background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18,
                  }}>{t.icon}</div>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: '#fafafa' }}>{t.author}</div>
                    <div style={{ fontSize: 12, color: '#71717a' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* =====================================================
          SECTION 7 — APPEL À L'ACTION FINAL
      ====================================================== */}
      <section className="cta-section" style={{
        padding: '100px 24px', textAlign: 'center', position: 'relative', overflow: 'hidden',
      }}>
        <div className="animate-glowPulse" style={{
          position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, #a855f710 0%, transparent 70%)',
          filter: 'blur(80px)', pointerEvents: 'none',
        }} />
        <div style={{ position: 'relative', zIndex: 1 }}>
          <h2 className="cta-title" style={{
            fontSize: 40, fontWeight: 800, color: '#fafafa', letterSpacing: '-1px', marginBottom: 16,
          }}>
            Prêt à rejoindre l&apos;aventure Vocoshop ?
          </h2>
          <p style={{ fontSize: 16, color: '#a1a1aa', marginBottom: 36, maxWidth: 480, margin: '0 auto 36px' }}>
            Crée ton compte en quelques minutes et commence à accompagner les commerçants dès aujourd&apos;hui.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link href="/devenir-agent" style={{
              display: 'inline-flex', padding: '18px 40px', borderRadius: 14,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              color: '#fff', fontSize: 18, fontWeight: 700, textDecoration: 'none',
              boxShadow: '0 0 40px #a855f730', transition: 'all 0.3s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.transform = 'translateY(-3px)'; e.currentTarget.style.boxShadow = '0 0 60px #a855f750'; }}
              onMouseLeave={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 0 40px #a855f730'; }}
            >Devenir Agent</Link>
            <Link href="/login" style={{
              display: 'inline-flex', padding: '18px 40px', borderRadius: 14,
              background: 'transparent', color: '#fafafa', fontSize: 18, fontWeight: 700,
              textDecoration: 'none', border: '1px solid #27272a', transition: 'all 0.3s',
            }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#a855f750'; e.currentTarget.style.background = '#a855f708'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#27272a'; e.currentTarget.style.background = 'transparent'; }}
            >Se connecter</Link>
          </div>
        </div>
      </section>

      <PublicFooter />
    </div>
  );
}
