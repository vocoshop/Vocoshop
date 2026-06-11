import Link from 'next/link';

export default function PublicFooter() {
  return (
    <footer style={{
      borderTop: '1px solid #1a1a1f',
      padding: '48px 24px 32px',
      background: '#0a0a0b',
    }}>
      <div style={{
        maxWidth: 1100,
        margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 40,
      }}>
        {/* Brand */}
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: 'linear-gradient(135deg, #a855f7, #7c3aed)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 16,
              fontWeight: 800,
              color: '#fff',
            }}>V</div>
            <span style={{ fontSize: 18, fontWeight: 700, color: '#fafafa' }}>Voco<span style={{ color: '#a855f7' }}>shop</span></span>
          </div>
          <p style={{ fontSize: 13, color: '#71717a', lineHeight: 1.6, maxWidth: 260 }}>
            La solution intelligente pour gérer ta boutique. OCR, ventes, stocks, financement — tout dans ta poche.
          </p>
        </div>

        {/* Links */}
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Plateforme</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Link href="/" style={{ fontSize: 13, color: '#a1a1aa', textDecoration: 'none' }}>Accueil</Link>
            <Link href="/devenir-agent" style={{ fontSize: 13, color: '#a1a1aa', textDecoration: 'none' }}>Devenir Agent</Link>
            <Link href="/login" style={{ fontSize: 13, color: '#a1a1aa', textDecoration: 'none' }}>Connexion</Link>
          </div>
        </div>

        {/* Contact */}
        <div>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#fafafa', marginBottom: 16, textTransform: 'uppercase', letterSpacing: 1 }}>Contact</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <span style={{ fontSize: 13, color: '#a1a1aa' }}>Brazzaville, Congo</span>
            <span style={{ fontSize: 13, color: '#a1a1aa' }}>contact@vocoshop.com</span>
          </div>
        </div>
      </div>

      <div style={{
        maxWidth: 1100,
        margin: '40px auto 0',
        paddingTop: 24,
        borderTop: '1px solid #1a1a1f',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: 16,
      }}>
        <span style={{ fontSize: 12, color: '#52525b' }}>
          © 2026 Vocoshop. Tous droits réservés.
        </span>
        <div style={{ display: 'flex', gap: 20 }}>
          <span style={{ fontSize: 12, color: '#52525b' }}>Fait avec 💜 à Brazzaville</span>
        </div>
      </div>
    </footer>
  );
}
