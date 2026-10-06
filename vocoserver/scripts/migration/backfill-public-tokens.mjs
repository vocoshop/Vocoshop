/**
 * 🔐 BACKFILL des publicToken sur les factures historiques.
 *
 * Les factures créées avant le correctif de sécurité n'ont pas de jeton.
 * Le code applicatif (routes/invoiceRoutes.ts:72) les génère à la demande
 * au premier téléchargement PDF. Ce script fait la même chose en une passe,
 * afin que les QR codes déjà distribués restent valides.
 *
 * AUCUN autre champ n'est modifié : on ne touche que publicToken.
 *
 * Usage : npx tsx scripts/migration/backfill-public-tokens.mjs [base]
 */
import { MongoClient } from "mongodb";
import crypto from "crypto";

const base = process.argv[2] || "vocoshop-prod";

if (!process.env.MONGO_URI) {
  console.error("MONGO_URI absente.");
  process.exit(1);
}

function uriFor(db) {
  const scheme = process.env.MONGO_URI.startsWith("mongodb+srv://") ? "mongodb+srv" : "mongodb";
  const auth = process.env.MONGO_URI.includes("@")
    ? process.env.MONGO_URI.slice(0, process.env.MONGO_URI.indexOf("@")).split("/")[2] + "@"
    : "";
  const host = process.env.MONGO_URI.slice(process.env.MONGO_URI.indexOf("@") + 1).split("/")[0];
  return `${scheme}://${auth}${host}/${encodeURIComponent(db)}`;
}

const client = new MongoClient(uriFor(base), { serverSelectionTimeoutMS: 15000 });
await client.connect();
const F = client.db(base).collection("factures");

console.log(`\n═══ BACKFILL publicToken sur '${base}' ═══\n`);

const avant = await F.find({}).toArray();
const sansToken = avant.filter((f) => !f.publicToken);
console.log(`  factures totales       : ${avant.length}`);
console.log(`  sans jeton (a traiter) : ${sansToken.length}`);
console.log(`  deja pourvues          : ${avant.length - sansToken.length}`);

if (sansToken.length === 0) {
  console.log("\n  Rien a faire.");
  await client.close();
  process.exit(0);
}

/* Un seul jeton par facture, 24 octets aleatoires — exactement le format
   de Invoice.ts:101 (crypto.randomBytes(24).toString("hex")). */
const generes = new Map();
for (const f of sansToken) {
  /* On regenere tant que le token existe deja ailleurs : garantie
     d'unicite stricte, meme si une facture en avait deja un. */
  let token;
  do {
    token = crypto.randomBytes(24).toString("hex");
  } while (generes.has(token));
  generes.set(token, f);

  const r = await F.updateOne({ _id: f._id, publicToken: { $in: [null, ""] } }, { $set: { publicToken: token } });
  if (r.matchedCount !== 1) {
    console.error(`  ! ${f.invoiceNumber} : aucune ecriture (deja pourvue entre-temps)`);
    generes.delete(token);
  }
}
console.log(`\n  jetons ecrits : ${generes.size}`);

const apres = await F.find({}).toArray();
const tokens = apres.map((f) => f.publicToken);
const uniques = new Set(tokens.filter(Boolean));
const avecToken = apres.filter((f) => typeof f.publicToken === "string" && f.publicToken.length === 48);

console.log(`\n=== CONTROLE ===\n`);
console.log(`  factures avec jeton        : ${avecToken.length} / ${apres.length}`);
console.log(`  jetons distincts           : ${uniques.size} / ${tokens.filter(Boolean).length}`);
console.log(`  longueur des jetons (hex48): ${[...new Set(tokens.filter(Boolean).map((t) => t.length))].join(", ")}`);

let ko = 0;
if (avecToken.length !== apres.length) { console.log("  X toutes les factures n'ont pas de jeton"); ko++; }
if (uniques.size !== tokens.filter(Boolean).length) { console.log("  X jetons dupliques"); ko++; }
if (!tokens.every((t) => /^[0-9a-f]{48}$/.test(t))) { console.log("  X format de jeton inattendu"); ko++; }

console.log("\n=== FACTEURS ===\n");
for (const f of apres.sort((a, b) => String(a.invoiceNumber).localeCompare(String(b.invoiceNumber)))) {
  console.log(`  ${f.invoiceNumber}  t=${f.publicToken.slice(0, 12)}...`);
}

console.log("\n" + (ko === 0 ? "BACKFILL OK." : `${ko} PROBLEME(S).`));
await client.close();
process.exit(ko === 0 ? 0 : 1);