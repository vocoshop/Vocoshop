"use client";

import { useEffect } from "react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Route Error]", error);
  }, [error]);

  return (
    <div style={{ padding: 40, textAlign: "center", fontFamily: "system-ui" }}>
      <h2 style={{ color: "#ef4444", marginBottom: 12 }}>Une erreur est survenue</h2>
      <p style={{ color: "#888", marginBottom: 20 }}>
        {error.message || "Erreur inconnue"}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "10px 24px",
          background: "#a855f7",
          color: "#fff",
          border: "none",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 14,
        }}
      >
        Réessayer
      </button>
    </div>
  );
}
