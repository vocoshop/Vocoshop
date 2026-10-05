"use client";

import { Suspense, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";

type Invoice = {
  invoiceNumber: string;
  plan: string;
  amount: number;
  currency: string;
  billingPeriodStart: string;
  billingPeriodEnd: string;
  paidAt: string;
  status: "PAYEE" | "EN_ATTENTE";
};

const card: React.CSSProperties = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 12,
  padding: 28,
  maxWidth: 560,
  margin: "0 auto",
};

const label: React.CSSProperties = {
  fontSize: 12,
  textTransform: "uppercase",
  letterSpacing: 0.6,
  color: "#6b7280",
  marginBottom: 4,
};

const value: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 600,
  color: "#111827",
};

const row: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 16,
  padding: "14px 0",
  borderBottom: "1px solid #f3f4f6",
};

function formatDateFR(d: string): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function formatAmount(n: number, c: string): string {
  const v = typeof n === "number" ? n.toLocaleString("fr-FR") : String(n);
  return `${v} ${c}`;
}

function InvoiceContent() {
  const params = useParams<{ invoiceNumber: string }>();
  const search = useSearchParams();
  const invoiceNumber = decodeURIComponent(params?.invoiceNumber ?? "");
  const token = search?.get("t") ?? "";

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");

  useEffect(() => {
    // Sans jeton on ne tente même pas l'appel : inutile d'aller
    // interroger l'API quand la capability URL est incomplète.
    if (!invoiceNumber || !token) {
      setState("error");
      return;
    }

    let cancelled = false;

    (async () => {
      try {
        const res = await fetch(
          `/api/invoices/public/${encodeURIComponent(invoiceNumber)}?t=${encodeURIComponent(token)}`,
          { cache: "no-store" }
        );

        if (cancelled) return;

        if (!res.ok) {
          setState("error");
          return;
        }

        setInvoice(await res.json());
        setState("ok");
      } catch {
        if (!cancelled) setState("error");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoiceNumber, token]);

  if (state === "loading") {
    return (
      <div style={{ ...card, textAlign: "center", color: "#6b7280", fontFamily: "system-ui" }}>
        Vérification de la facture…
      </div>
    );
  }

  if (state === "error" || !invoice) {
    return (
      <div style={{ ...card, fontFamily: "system-ui" }}>
        <div style={{ fontSize: 44, marginBottom: 12 }}>🔒</div>
        <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 10 }}>
          Facture non vérifiable
        </h1>
        <p style={{ color: "#555", lineHeight: 1.6, marginBottom: 20 }}>
          Ce lien est incomplet ou n&apos;est plus valide. Scanné depuis le QR code
          d&apos;un PDF Vocoshop, il contient normalement un jeton de sécurité.
        </p>
        <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
          Pour toute question, contactez le support Vocoshop.
        </p>
        <a
          href="/"
          style={{
            display: "inline-block",
            padding: "12px 28px",
            background: "#6C4BFF",
            color: "#fff",
            borderRadius: 8,
            fontSize: 15,
            fontWeight: 600,
            textDecoration: "none",
          }}
        >
          Retour à Vocoshop
        </a>
      </div>
    );
  }

  return (
    <div style={{ ...card, fontFamily: "system-ui" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <div style={{ fontSize: 24, fontWeight: 700, color: "#6C4BFF" }}>VOCOSHOP</div>
        <div
          style={{
            marginLeft: "auto",
            padding: "6px 14px",
            borderRadius: 999,
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 0.5,
            color: invoice.status === "PAYEE" ? "#166534" : "#92400e",
            background: invoice.status === "PAYEE" ? "#dcfce7" : "#fef3c7",
          }}
        >
          {invoice.status === "PAYEE" ? "PAYÉE" : "EN ATTENTE"}
        </div>
      </div>

      <h1 style={{ fontSize: 20, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
        Facture {invoice.invoiceNumber}
      </h1>
      <p style={{ color: "#6b7280", fontSize: 14, marginBottom: 20 }}>
        Abonnement {invoice.plan} · {formatDateFR(invoice.paidAt)}
      </p>

      <div style={row}>
        <div>
          <div style={label}>Montant</div>
          <div style={{ ...value, fontSize: 22 }}>{formatAmount(invoice.amount, invoice.currency)}</div>
        </div>
      </div>

      <div style={row}>
        <div>
          <div style={label}>Période de facturation</div>
          <div style={value}>
            {formatDateFR(invoice.billingPeriodStart)} → {formatDateFR(invoice.billingPeriodEnd)}
          </div>
        </div>
      </div>

      <div style={{ ...row, borderBottom: "none" }}>
        <div>
          <div style={label}>Plan</div>
          <div style={value}>{invoice.plan}</div>
        </div>
      </div>

      <p style={{ color: "#9ca3af", fontSize: 12, textAlign: "center", marginTop: 28 }}>
        Document généré par Vocoshop — www.vocoshop.app
      </p>
    </div>
  );
}

export default function InvoicePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#f9fafb",
        display: "flex",
        alignItems: "center",
        padding: "48px 20px",
      }}
    >
      <Suspense
        fallback={
          <div style={{ ...card, textAlign: "center", color: "#6b7280", fontFamily: "system-ui" }}>
            Chargement…
          </div>
        }
      >
        <InvoiceContent />
      </Suspense>
    </main>
  );
}