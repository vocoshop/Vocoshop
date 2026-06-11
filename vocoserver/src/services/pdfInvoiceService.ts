import PDFDocument from "pdfkit";
import QRCode from "qrcode";

/* =====================================================
🔥 LABEL HUMAIN (Février 2026)
===================================================== */
function getInvoiceLabel(date: any) {
const d = new Date(date);

return d.toLocaleDateString("fr-FR", {
month: "long",
year: "numeric",
});
}

/* =====================================================
🔥 FORMAT DATE COURTE FR
===================================================== */
function formatDateFR(date: any) {
if (!date) return "—";

return new Date(date).toLocaleDateString("fr-FR", {
day: "2-digit",
month: "long",
year: "numeric",
});
}

export async function generateInvoicePDF(invoice: any) {
const doc = new PDFDocument({
size: "A4",
margin: 50,
});

const buffers: any[] = [];

doc.on("data", (b) => buffers.push(b));

return new Promise<Buffer>(async (resolve) => {
doc.on("end", () => {
resolve(Buffer.concat(buffers));
});

/* =====================================================
🔥 WATERMARK
===================================================== */

doc.save();

doc.rotate(-20, { origin: [300, 400] });

doc
.fillColor("#6C4BFF")
.fontSize(90)
.opacity(0.04)
.text("VOCOSHOP", -50, 350, { align: "center" });

doc.restore();
doc.opacity(1);

/* =====================================================
🔥 HEADER
===================================================== */

doc
.fillColor("#6C4BFF")
.fontSize(22)
.text("VOCOSHOP", 50, 50);

doc
.fillColor("#888")
.fontSize(10)
.text("Plateforme intelligente pour commerçants", 50, 75);

const invoiceLabel = getInvoiceLabel(invoice.billingPeriodStart || invoice.createdAt);

doc
.fillColor("#000")
.fontSize(16)
.text("FACTURE", 400, 50, { align: "right" });

doc
.fontSize(11)
.text(`Facture ${invoiceLabel}`, 400, 70, { align: "right" });

doc
.fontSize(10)
.fillColor("#666")
.text(`N° ${invoice.invoiceNumber}`, 400, 85, { align: "right" });

/* =====================================================
🔥 INFOS CLIENT
===================================================== */

const shopName =
invoice.shopName ||
invoice.storeName ||
"Boutique Vocoshop";

doc
.fontSize(11)
.fillColor("#000")
.text("Facturé à :", 50, 140);

doc
.fillColor("#444")
.text(shopName, 50, 160);

doc
.fillColor("#000")
.text("Date de paiement :", 350, 140);

doc
.fillColor("#444")
.text(formatDateFR(invoice.paidAt || invoice.createdAt), 350, 160);

/* =====================================================
🔥 PERIODE FACTURATION (IMPORTANT)
===================================================== */

doc
.fillColor("#000")
.fontSize(11)
.text("Période couverte :", 50, 190);

doc
.fillColor("#6C4BFF")
.fontSize(11)
.text(
`${formatDateFR(invoice.billingPeriodStart)} → ${formatDateFR(invoice.billingPeriodEnd)}`,
160,
190
);

/* =====================================================
🔥 TABLE HEADER
===================================================== */

const tableTop = 230;

doc.rect(50, tableTop, 500, 25).fill("#111");

doc
.fillColor("#FFF")
.fontSize(12)
.text("Description", 60, tableTop + 7)
.text("Plan", 300, tableTop + 7)
.text("Montant", 450, tableTop + 7);

/* =====================================================
🔥 TABLE ROW
===================================================== */

doc.rect(50, tableTop + 25, 500, 30).stroke("#DDD");

doc
.fillColor("#000")
.fontSize(12)
.text("Abonnement Vocoshop", 60, tableTop + 35)
.text(invoice.plan, 300, tableTop + 35)
.text(`${invoice.amount} ${invoice.currency}`, 450, tableTop + 35);

/* =====================================================
🔥 TOTAL
===================================================== */

doc.roundedRect(300, tableTop + 100, 250, 50, 8).fill("#F4F2FF");

doc
.fillColor("#6C4BFF")
.fontSize(11)
.text("TOTAL", 310, tableTop + 110);

doc
.fillColor("#000")
.fontSize(16)
.text(`${invoice.amount} ${invoice.currency}`, 310, tableTop + 125);

/* =====================================================
🔥 QR CODE
===================================================== */

const publicUrl = `https://vocoshop.app/invoice/${invoice.invoiceNumber}`;

const qr = await QRCode.toDataURL(publicUrl);
const base64Data = qr.replace(/^data:image\/png;base64,/, "");

doc.image(
Buffer.from(base64Data, "base64"),
50,
tableTop + 100,
{ width: 80 }
);

/* =====================================================
🔥 FOOTER
===================================================== */

doc
.fillColor("#888")
.fontSize(10)
.text(
"Merci d'utiliser Vocoshop — www.vocoshop.app",
50,
750,
{ align: "center" }
);

doc.end();
});
}
