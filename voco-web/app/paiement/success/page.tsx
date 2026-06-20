export default function PaiementSuccessPage() {
  return (
    <div style={{ padding: 60, textAlign: "center", fontFamily: "system-ui", maxWidth: 500, margin: "0 auto" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>✅</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#16a34a", marginBottom: 12 }}>
        Paiement réussi !
      </h1>
      <p style={{ color: "#555", lineHeight: 1.6, marginBottom: 24 }}>
        Votre abonnement VocoShop PRO est en cours d&apos;activation.
        Vous allez recevoir une confirmation sous quelques instants.
      </p>
      <a
        href="https://www.vocoshop.app"
        style={{
          display: "inline-block",
          padding: "12px 32px",
          background: "#16a34a",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 15,
          fontWeight: 600,
          textDecoration: "none",
        }}
      >
        Retourner sur VocoShop
      </a>
    </div>
  );
}
