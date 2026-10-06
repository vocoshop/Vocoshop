/**
 * Vérifie la vraie route publique /api/invoices/public/:invoiceNumber
 * en montant le routeur réel de l'application sur un express minimal.
 * Aucun serveur complet n'est lancé, aucune donnée n'est écrite.
 *
 * Usage : npx tsx scripts/migration/verify-public-invoice.mjs [base]
 */
import express from "express";
import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const base = process.argv[2] || "vocoshop-prod";

function uriFor(db) {
  const raw = process.env.MONGO_URI;
  const scheme = raw.startsWith("mongodb+srv://") ? "mongodb+srv" : "mongodb";
  const auth = raw.includes("@") ? raw.slice(0, raw.indexOf("@")).split("/")[2] + "@" : "";
  const host = raw.slice(raw.indexOf("@") + 1).split("/")[0];
  return `${scheme}://${auth}${host}/${encodeURIComponent(db)}`;
}

await mongoose.connect(uriFor(base), { serverSelectionTimeoutMS: 15000 });
console.log(`  base : ${mongoose.connection.db.databaseName}\n`);

const app = express();
app.use(express.json());
const { default: invoiceRoutes } = await import("../../src/routes/invoiceRoutes.ts");
app.use("/api/invoices", invoiceRoutes);

const server = app.listen(5099);
const F = mongoose.connection.db.collection("factures");
const factures = await F.find({}).sort({ invoiceNumber: 1 }).toArray();

let ok = 0;
let ko = 0;
const j = (r) => JSON.stringify(r);

console.log("═══ 1. URL publique avec le BON jeton ═══\n");
for (const f of factures) {
  const r = await fetch(`http://127.0.0.1:5099/api/invoices/public/${f.invoiceNumber}?t=${f.publicToken}`);
  const body = await r.json();
  const leak = ["_id", "storeId", "transactionId", "publicToken"].filter(
    (k) => body && Object.prototype.hasOwnProperty.call(body, k)
  );
  const conforme = r.status === 200 && body.invoiceNumber === f.invoiceNumber && leak.length === 0;
  if (conforme) ok++;
  else ko++;
  console.log(
    `  ${conforme ? "✅" : "❌"} ${f.invoiceNumber}  HTTP ${r.status}  ${f.amount} ${f.currency}  fuite=${leak.length ? leak.join(",") : "aucune"}`
  );
}

console.log("\n═══ 2. Jetons : uniques et fonctionnels ═══\n");
const tokens = factures.map((f) => f.publicToken);
console.log(`  jetons distincts : ${new Set(tokens).size} / ${tokens.length}`);
console.log(`  format hex(48)   : ${tokens.every((t) => /^[0-9a-f]{48}$/.test(t)) ? "tous conformes" : "INCONFORME"}`);

console.log("\n═══ 3. Réflexes de sécurité ═══\n");
const f0 = factures[0];
const mauvais = f0.publicToken.slice(0, -1) + (f0.publicToken.endsWith("a") ? "b" : "a");
const cas = [
  ["jeton faux (1 caractere change)", `?t=${mauvais}`, 404],
  ["sans jeton", "", 404],
  ["jeton vide", "?t=", 404],
  ["facture inexistante + bon format", null, 404],
];
for (const [label, q, attendu] of cas) {
  const url =
    label === "facture inexistante + bon format"
      ? `http://127.0.0.1:5099/api/invoices/public/VOC-9999-000000?t=${tokens[0]}`
      : `http://127.0.0.1:5099/api/invoices/public/${f0.invoiceNumber}${q}`;
  const r = await fetch(url);
  const b = await r.json();
  const bon = r.status === attendu && b.error === "Facture introuvable";
  if (bon) ok++;
  else ko++;
  console.log(`  ${bon ? "✅" : "❌"} ${label}  HTTP ${r.status} (${attendu} attendu)  ${b.error || ""}`);
}

console.log("\n═══ 4. Quelqu'un peut-il lister les factures ? ═══\n");
for (const [m, u] of [
  ["GET", "http://127.0.0.1:5099/api/invoices/"],
  ["GET", "http://127.0.0.1:5099/api/invoices"],
]) {
  const r = await fetch(u, { method: m });
  const protege = r.status !== 200;
  if (protege) ok++;
  else ko++;
  console.log(`  ${protege ? "✅" : "❌"} ${m} ${u.replace("http://127.0.0.1:5099", "")}  HTTP ${r.status} (401/403 attendu)`);
}

server.close();
await mongoose.disconnect();
console.log(`\n${"═".repeat(46)}\n  Résultat : ${ok} OK / ${ko} ÉCHEC\n${"═".repeat(46)}\n`);
process.exit(ko === 0 ? 0 : 1);