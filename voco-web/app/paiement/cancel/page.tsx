export default function PaiementCancelPage() {
  return (
    <div style={{ padding: 60, textAlign: "center", fontFamily: "system-ui", maxWidth: 500, margin: "0 auto" }}>
      <div style={{ fontSize: 56, marginBottom: 16 }}>⏸️</div>
      <h1 style={{ fontSize: 24, fontWeight: 700, color: "#ea580c", marginBottom: 12 }}>
        Paiement annulé
      </h1>
      <p style={{ color: "#555", lineHeight: 1.6, marginBottom: 24 }}>
        Vous avez annulé le paiement. Aucun montant n&apos;a été débité.
        Vous pouvez réessayer quand vous voulez depuis l&apos;application.
      </p>
      <a
        href="https://www.vocoshop.app"
        style={{
          display: "inline-block",
          padding: "12px 32px",
          background: "#ea580c",
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
