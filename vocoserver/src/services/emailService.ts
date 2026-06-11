// services/emailService.ts
import nodemailer from "nodemailer";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.SMTP_USER || "",
    pass: process.env.SMTP_PASS || "",
  },
});

/* =====================================================
   LETTRE DE DEMANDE DE PRÊT — HTML
   ===================================================== */
export function buildLoanRequestEmail(params: {
  merchantName: string;
  merchantCity: string;
  merchantPhone: string;
  shopId: string;
  amount: number;
  objective: string;
  partnerName: string;
  score: number;
  scoreLabel: string;
  monthlyRevenue: number;
  monthlyProfit: number;
  monthsActive: number;
  totalSales: number;
  dashboardUrl: string;
  pdfUrl: string;
  verifyUrl: string;
  date: string;
}) {
  const {
    merchantName, merchantCity, merchantPhone, shopId,
    amount, objective, partnerName,
    score, scoreLabel, monthlyRevenue, monthlyProfit, monthsActive, totalSales,
    dashboardUrl, pdfUrl, verifyUrl, date,
  } = params;

  const formattedAmount = amount.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const formattedRevenue = monthlyRevenue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const formattedProfit = monthlyProfit.toString().replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  const scoreColor = score >= 70 ? "#16a34a" : score >= 40 ? "#ca8a04" : "#dc2626";

  const subject = `Demande de financement — ${merchantName} — Vocoshop`;

  const html = `<!DOCTYPE html>
<html lang="fr">
<head><meta charset="utf-8"/></head>
<body style="margin:0;padding:0;background:#f4f4f5;font-family:Georgia,'Times New Roman',serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f5;padding:30px 0">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:8px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,.08)">

<!-- HEADER -->
<tr><td style="background:linear-gradient(135deg,#1e1b4b 0%,#4c1d95 100%);padding:28px 36px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td><span style="font-family:system-ui,sans-serif;font-size:20px;font-weight:800;color:#fff;letter-spacing:1px">VOCOSHOP</span></td>
<td align="right"><span style="font-family:system-ui,sans-serif;font-size:11px;color:rgba(255,255,255,.6)">Plateforme de gestion</span></td>
</tr>
</table>
</td></tr>

<!-- DATE + DESTINATAIRE -->
<tr><td style="padding:30px 36px 0">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="font-size:13px;color:#6b7280">Brazzaville, le ${date}</td>
<td align="right" style="font-size:13px;color:#6b7280">Réf : VS-${shopId}-${Date.now().toString(36).toUpperCase()}</td>
</tr>
</table>
</td></tr>

<!-- OBJET -->
<tr><td style="padding:24px 36px 0">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:6px">
<tr><td style="padding:12px 16px">
<span style="font-family:system-ui,sans-serif;font-size:12px;font-weight:700;color:#166534;text-transform:uppercase;letter-spacing:1px">Objet : Demande de financement</span>
</td></tr>
</table>
</td></tr>

<!-- CORPS DE LA LETTRE -->
<tr><td style="padding:24px 36px 0;font-size:14px;color:#374151;line-height:1.8">
<p style="margin:0 0 16px">Madame, Monsieur,</p>
<p style="margin:0 0 16px">
Je soussigné(e) <strong>${merchantName}</strong>, exploitant(e) d'un commerce enregistré
sous l'identifiant <strong>${shopId}</strong> situé à ${merchantCity || "Brazzaville"},
ai l'honneur de vous soumettre ma demande de financement d'un montant de
<strong style="color:#1e1b4b;font-size:16px">${formattedAmount} FCFA</strong>.
</p>
<p style="margin:0 0 16px">
${objective ? `L'objet de cette demande est : <em>${objective}</em>.` : ""}
Mon activité commerciale est enregistrée et suivie via la plateforme Vocoshop,
ce qui vous garantit une <strong>traçabilité complète et authentifiée</strong> de mes données financières.
</p>
</td></tr>

<!-- DONNÉES FINANCIÈRES -->
<tr><td style="padding:20px 36px 0">
<table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7eb;border-radius:8px;overflow:hidden">
<tr><td style="background:#f9fafb;padding:10px 16px;border-bottom:1px solid #e5e7eb">
<span style="font-family:system-ui,sans-serif;font-size:12px;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.5px">Synthèse financière vérifiable</span>
</td></tr>
<tr><td style="padding:16px">
<table width="100%" cellpadding="0" cellspacing="0">
<tr>
<td style="padding:6px 0;font-size:13px;color:#6b7280">Score Vocoshop</td>
<td align="right" style="padding:6px 0"><span style="font-size:14px;font-weight:800;color:${scoreColor}">${score}/100 — ${scoreLabel}</span></td>
</tr>
<tr><td colspan="2" style="border-bottom:1px solid #f3f4f6"></td></tr>
<tr>
<td style="padding:6px 0;font-size:13px;color:#6b7280">Chiffre d'affaires mensuel</td>
<td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#111827">${formattedRevenue} FCFA</td>
</tr>
<tr><td colspan="2" style="border-bottom:1px solid #f3f4f6"></td></tr>
<tr>
<td style="padding:6px 0;font-size:13px;color:#6b7280">Profit mensuel estimé</td>
<td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#16a34a">${formattedProfit} FCFA</td>
</tr>
<tr><td colspan="2" style="border-bottom:1px solid #f3f4f6"></td></tr>
<tr>
<td style="padding:6px 0;font-size:13px;color:#6b7280">Ancienneté sur la plateforme</td>
<td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#111827">${monthsActive} mois</td>
</tr>
<tr><td colspan="2" style="border-bottom:1px solid #f3f4f6"></td></tr>
<tr>
<td style="padding:6px 0;font-size:13px;color:#6b7280">Nombre total de ventes enregistrées</td>
<td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#111827">${totalSales}</td>
</tr>
<tr><td colspan="2" style="border-bottom:1px solid #f3f4f6"></td></tr>
<tr>
<td style="padding:6px 0;font-size:13px;color:#6b7280">Téléphone</td>
<td align="right" style="padding:6px 0;font-size:13px;font-weight:700;color:#111827">${merchantPhone}</td>
</tr>
</table>
</td></tr>
</table>
</td></tr>

<!-- LIEN VERS LE DASHBOARD -->
<tr><td style="padding:24px 36px 0">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:8px">
<tr><td style="padding:16px;text-align:center">
<p style="margin:0 0 8px;font-family:system-ui,sans-serif;font-size:12px;font-weight:700;color:#1e40af;text-transform:uppercase;letter-spacing:.5px">
📊 Tableau de bord complet
</p>
<p style="margin:0 0 14px;font-size:13px;color:#374151;line-height:1.6">
Consultez le bilan financier complet, certifié et vérifiable :
</p>
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr>
<td style="background:#1e1b4b;border-radius:6px;padding:10px 24px">
<a href="${dashboardUrl}" style="font-family:system-ui,sans-serif;font-size:13px;font-weight:700;color:#fff;text-decoration:none;display:inline-block">
Consulter le tableau de bord →
</a>
</td>
</tr>
</table>
<p style="margin:12px 0 0;font-size:11px;color:#6b7280">
Lien sécurisé · Expiration 30 jours · Données certifiées SHA-256
</p>
</td></tr>
</table>
</td></tr>

<!-- CTA -->
<tr><td style="padding:20px 36px 0;text-align:center">
<table cellpadding="0" cellspacing="0" style="margin:0 auto">
<tr>
<td style="background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:8px 16px">
<a href="${pdfUrl}" style="font-family:system-ui,sans-serif;font-size:12px;font-weight:600;color:#374151;text-decoration:none">
📄 Télécharger le PDF
</a>
</td>
<td style="width:8px"></td>
<td style="background:#fff;border:1px solid #d1d5db;border-radius:6px;padding:8px 16px">
<a href="${verifyUrl}" style="font-family:system-ui,sans-serif;font-size:12px;font-weight:600;color:#374151;text-decoration:none">
🛡️ Vérifier l'authenticité
</a>
</td>
</tr>
</table>
</td></tr>

<!-- SIGNATURE -->
<tr><td style="padding:28px 36px 0;font-size:14px;color:#374151;line-height:1.8">
<p style="margin:0 0 16px">
Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.
</p>
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:20px;border-top:1px solid #e5e7eb;padding-top:16px">
<tr>
<td style="padding-top:16px">
<strong style="font-size:14px;color:#111827">${merchantName}</strong><br/>
<span style="font-size:12px;color:#6b7280">${shopId} · ${merchantCity || "Brazzaville"}</span><br/>
<span style="font-size:12px;color:#6b7280">${merchantPhone}</span>
</td>
<td align="right" style="padding-top:16px">
<div style="text-align:right">
<div style="font-family:system-ui,sans-serif;font-size:24px;font-weight:900;color:${scoreColor}">${score}</div>
<div style="font-family:system-ui,sans-serif;font-size:10px;color:#9ca3af;text-transform:uppercase;letter-spacing:1px">Score Vocoshop</div>
</div>
</td>
</tr>
</table>
</td></tr>

<!-- FOOTER -->
<tr><td style="padding:24px 36px 28px">
<table width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid #e5e7eb;padding-top:16px">
<tr><td style="padding-top:16px">
<p style="margin:0;font-size:11px;color:#9ca3af;line-height:1.6">
Ce document et les données qu'il contient sont générés automatiquement par la plateforme Vocoshop.
Les informations financières sont certifiées par empreinte numérique SHA-256 et peuvent être vérifiées
via le lien de vérification ci-dessus.
</p>
<p style="margin:8px 0 0;font-size:11px;color:#9ca3af">
Vocoshop — Plateforme de gestion de boutiques · Brazzaville, Congo
</p>
</td></tr>
</table>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;

  const text = `
DEMANTE DE FINANCEMENT — VOCOSHOP

Brazzaville, le ${date}
Réf : VS-${shopId}-${Date.now().toString(36).toUpperCase()}

Objet : Demande de financement

Madame, Monsieur,

Je soussigné(e) ${merchantName}, exploitant(e) d'un commerce enregistré
sous l'identifiant ${shopId} situé à ${merchantCity || "Brazzaville"},
ai l'honneur de vous soumettre ma demande de financement d'un montant de
${formattedAmount} FCFA.

${objective ? `L'objet de cette demande est : ${objective}.` : ""}

SYNTHÈSE FINANCIÈRE :
- Score Vocoshop : ${score}/100 — ${scoreLabel}
- Chiffre d'affaires mensuel : ${formattedRevenue} FCFA
- Profit mensuel estimé : ${formattedProfit} FCFA
- Ancienneté : ${monthsActive} mois
- Ventes enregistrées : ${totalSales}
- Téléphone : ${merchantPhone}

TABLEAU DE BORD COMPLET :
${dashboardUrl}

Télécharger le PDF : ${pdfUrl}
Vérifier l'authenticité : ${verifyUrl}

Je vous prie d'agréer, Madame, Monsieur, l'expression de mes salutations distinguées.

${merchantName}
${shopId} · ${merchantCity || "Brazzaville"} · ${merchantPhone}

Score Vocoshop : ${score}/100
`.trim();

  return { subject, html, text };
}

/* =====================================================
   ENVOI D'EMAIL
   ===================================================== */
export async function sendLoanRequestEmail(params: {
  to: string;
  merchantName: string;
  merchantCity: string;
  merchantPhone: string;
  shopId: string;
  amount: number;
  objective: string;
  partnerName: string;
  score: number;
  scoreLabel: string;
  monthlyRevenue: number;
  monthlyProfit: number;
  monthsActive: number;
  totalSales: number;
  dashboardUrl: string;
  pdfUrl: string;
  verifyUrl: string;
}): Promise<{ sent: boolean; error?: string }> {
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpUser || !smtpPass) {
    console.warn("⚠️ SMTP non configuré — email non envoyé. Configure SMTP_USER et SMTP_PASS dans .env");
    return { sent: false, error: "SMTP non configuré" };
  }

  const date = new Intl.DateTimeFormat("fr-FR", {
    timeZone: "Africa/Brazzaville",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const { subject, html, text } = buildLoanRequestEmail({
    ...params,
    date,
  });

  try {
    await transporter.sendMail({
      from: `"Vocoshop" <${smtpUser}>`,
      to: params.to,
      subject,
      text,
      html,
      replyTo: params.merchantPhone.includes("@") ? params.merchantPhone : undefined,
    });

    console.log(`✅ Email envoyé à ${params.to} pour ${params.merchantName}`);
    return { sent: true };
  } catch (err: any) {
    console.error("❌ Envoi email échoué:", err?.message || err);
    return { sent: false, error: err?.message || "Erreur envoi" };
  }
}
