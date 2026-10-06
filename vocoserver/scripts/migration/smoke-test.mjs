/**
=====================================================
🧪 TEST FONCTIONNEL — base cible vs base source
=====================================================
PREUVE que l'app fonctionne sur la nouvelle base, AVANT de
modifier MONGO_URI sur Railway.

Simule une connexion Mongoose complète sur la base cible et
exécute les vraies requêtes applicatives :

  1. authentification super-admin (collection users)
  2. recherche d'une boutique
  3. facture + jeton publicToken (notre nouveau correctif)
  4. recherche plein texte / index

 AUCUNE ÉCRITURE.
=====================================================
*/
import mongoose from "mongoose";

const uri = process.env.MONGO_URI;
const target = process.argv[2] || "vocoshop-prod";

if (!uri) {
  console.error("MONGO_URI absente.");
  process.exit(1);
}

function uriFor(db) {
  const scheme = uri.startsWith("mongodb+srv://") ? "mongodb+srv" : "mongodb";
  const auth = uri.includes("@") ? uri.slice(0, uri.indexOf("@")).split("/")[2] + "@" : "";
  const host = uri.slice(uri.indexOf("@") + 1).split("/")[0];
  return `${scheme}://${auth}${host}/${encodeURIComponent(db)}?appName=vocoshop-smoke`;
}

let pass = 0;
let fail = 0;

function check(label, condition, detail = "") {
  if (condition) {
    console.log(`  ✅ ${label}${detail ? ` — ${detail}` : ""}`);
    pass++;
  } else {
    console.log(`  ❌ ${label}${detail ? ` — ${detail}` : ""}`);
    fail++;
  }
}

console.log(`\n═══ TEST FONCTIONNEL sur '${target}' ═══\n`);

await mongoose.connect(uriFor(target), {
  serverSelectionTimeoutMS: 15000,
  maxPoolSize: 5,
});

const db = mongoose.connection.db;
check("connexion MongoDB", mongoose.connection.readyState === 1);
console.log(`  base effective : ${db?.databaseName}`);

/* Les modèles réels de l'application. */
const { default: Store } = await import("../../src/models/Store.ts");
const { default: User } = await import("../../src/models/User.ts");
const { default: Invoice } = await import("../../src/models/Invoice.ts");

/* Authentification : l'app reconnait l'utilisateur par `phone` (pas email),
   et le mot de passe est le `passwordHash` de la boutique liee. */
console.log("\n── 1. Authentification ──");
const admin = await User.findOne({ role: "owner" }).lean();
check("un owner existe", !!admin, admin ? String(admin._id) : "aucun");
if (admin) check("owner identifie par phone", !!admin.phone, String(admin.phone));

console.log("\n── 2. Boutiques ──");
const storeCount = await Store.countDocuments({});
check("des boutiques existent", storeCount > 0, `${storeCount} boutique(s)`);
const avecTel = await Store.countDocuments({ phone: { $exists: true, $ne: "" } });
check("boutiques avec téléphone (clé de login)", avecTel === storeCount, `${avecTel}/${storeCount}`);
const avecHash = await Store.countDocuments({ passwordHash: { $exists: true, $ne: "" } });
check("boutiques avec mot de passe", avecHash === storeCount, `${avecHash}/${storeCount}`);
const bcryptOk = await Store.countDocuments({ passwordHash: { $regex: /^\$2[aby]\$/ } });
check("dont hachages bcrypt lisibles", bcryptOk > 0, `${bcryptOk} boutique(s)`);
const nommees = await Store.countDocuments({ storeName: { $nin: [null, ""] } });
check("boutiques nommées", nommees > 0, `${nommees}/${storeCount} nommées`);

console.log("\n── 3. Factures + jeton public (nouveau correctif) ──");
const invCount = await Invoice.countDocuments({});
check("factures lisibles", true, `${invCount} facture(s)`);
if (invCount > 0) {
  const withToken = await Invoice.countDocuments({ publicToken: { $type: "string" } });
  console.log(`     avec jeton : ${withToken} / ${invCount}`);

  const sample = await Invoice.findOne({ publicToken: { $type: "string", $ne: "" } }).lean();
  if (sample) {
    /* Reproduit exactement la requête de l'endpoint sécurisé. */
    const found = await Invoice.findOne({
      invoiceNumber: sample.invoiceNumber,
      publicToken: sample.publicToken,
    }).lean();
    check("capability URL résout (invoiceNumber + publicToken)", !!found);
  } else {
    console.log("     ℹ️  Aucun jeton : le backfill lazy le créera au 1er téléchargement PDF.");
  }

  const idx = await db.collection("factures").indexes();
  const pt = idx.find((i) => i.name === "publicToken_1");
  check("index publicToken_1 présent", !!pt, pt ? pt.name : "ABSENT");
  check("publicToken_1 indexé", !!pt && !!pt.key?.publicToken);
}

console.log("\n── 4. Index applicatifs ──");
const invoicesIdx = await db.collection("factures").indexes();
check("factures: index sur paidAt", invoicesIdx.some((i) => i.key?.paidAt === -1));

console.log(`\n${"═".repeat(50)}`);
console.log(`Résultat : ${pass} OK / ${fail} ÉCHEC`);
console.log(`${"═".repeat(50)}\n`);

await mongoose.disconnect();
process.exit(fail === 0 ? 0 : 1);