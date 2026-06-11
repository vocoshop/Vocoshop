"use client";

export default function NotFound() {
  return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
      <h2 style={{ color: "#888", marginBottom: 12 }}>404</h2>
      <p style={{ color: "#666", marginBottom: 20 }}>Page introuvable</p>
      <a
        href="/"
        style={{
          padding: "10px 24px",
          background: "#a855f7",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 14,
          textDecoration: "none",
        }}
      >
        Retour à l&apos;accueil
      </a>
    </div>
  );
}
