/**
=====================================================
🔍 VÉRIFICATION D'INTÉGRITÉ DU BACKUP
=====================================================
Relit le .bson depuis le disque et le confronte à la base
source (read-only). Aucune écriture.

Usage :
  node verify-backup.mjs <fichier.bson> <baseSource>
=====================================================
*/
import { MongoClient } from "mongodb";
import { BSON } from "bson";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const file = process.argv[2];
const sourceDb = process.argv[3] || "test";
const uri = process.env.MONGO_URI;

if (!file || !uri) {
  console.error("Usage : node verify-backup.mjs <fichier.bson> [base]");
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`⛔ Fichier absent : ${file}`);
  process.exit(1);
}

/* ── 1. Le fichier est-il complet au sens BSON ? ── */
const buf = fs.readFileSync(file);
let offset = 0;
let docsInFile = 0;
let truncated = false;

while (offset < buf.length) {
  if (offset + 4 > buf.length) {
    truncated = true;
    break;
  }
  const size = buf.readInt32LE(offset);
  if (size <= 0 || offset + size > buf.length) {
    truncated = true;
    break;
  }
  offset += size;
  docsInFile++;
}

const manifestPath = file.replace(/\.bson$/, ".manifest.json");
const manifest = fs.existsSync(manifestPath)
  ? JSON.parse(fs.readFileSync(manifestPath, "utf8"))
  : null;

console.log(`\n═══ INTÉGRITÉ DU BACKUP ═══\n`);
console.log(`  fichier     : ${path.basename(file)}`);
console.log(`  taille      : ${(buf.length / 1048576).toFixed(2)} Mo`);
console.log(`  sha256      : ${crypto.createHash("sha256").update(buf).digest("hex")}`);
console.log(`  blocs BSON  : ${docsInFile}`);
console.log(`  tranché     : ${truncated ? "OUI ⛔" : "non"}`);

if (!manifest) {
  console.log("  manifeste   : ABSENT ⛔");
  process.exit(1);
}
console.log(`  manifeste   : ${manifest.collections.length} collections, ${manifest.total} documents`);
console.log(`  base source : ${manifest.dbName}`);
console.log(`  backup pris : ${manifest.takenAt}`);

const fromManifest = manifest.collections.reduce((s, c) => s + c.count, 0);
console.log(`  somme manifeste : ${fromManifest}`);
console.log(
  `  concordance fichier/manifeste : ${docsInFile === fromManifest ? "✅ OK" : "⛔ ÉCART"}`
);

if (truncated || docsInFile !== fromManifest) {
  console.log("\n⛔ BACKUP INCOMPLET — ne pas restaurer.\n");
  process.exit(1);
}

/* ── 2. Comparaison avec la base source (read-only) ── */
const scheme = uri.startsWith("mongodb+srv://") ? "mongodb+srv" : "mongodb";
const auth = uri.includes("@") ? uri.slice(0, uri.indexOf("@")).split("/")[2] + "@" : "";
const host = uri.slice(uri.indexOf("@") + 1).split("/")[0];
const client = new MongoClient(
  `${scheme}://${auth}${host}/${encodeURIComponent(sourceDb)}?appName=vocoshop-verify`,
  { serverSelectionTimeoutMS: 20000 }
);
await client.connect();
const db = client.db(sourceDb);

console.log(`\n── Comparaison avec la base '${sourceDb}' en direct ──\n`);

let mismatches = 0;
for (const entry of manifest.collections) {
  const live = await db.collection(entry.collection).countDocuments({});
  const ok = live === entry.count;
  if (!ok) mismatches++;
  const mark = ok ? "✅" : "⛔";
  if (entry.count > 0 || live > 0) {
    console.log(`  ${mark} ${entry.collection.padEnd(26)} backup ${String(entry.count).padStart(6)}   live ${String(live).padStart(6)}`);
  }
}

await client.close();

const liveTotal = await (async () => {
  const c2 = new MongoClient(
    `${scheme}://${auth}${host}/${encodeURIComponent(sourceDb)}?appName=vocoshop-verify`,
    { serverSelectionTimeoutMS: 20000 }
  );
  await c2.connect();
  const d = c2.db(sourceDb);
  const names = (await d.listCollections({}, { nameOnly: true }).toArray()).map((x) => x.name);
  let t = 0;
  for (const n of names) t += await d.collection(n).countDocuments({});
  await c2.close();
  return t;
})();

console.log(`\n${"═".repeat(64)}`);
console.log(`Backup      : ${docsInFile} documents`);
console.log(`Base source : ${liveTotal} documents`);
console.log(`Écarts      : ${mismatches}`);
console.log(`${"═".repeat(64)}`);

if (mismatches === 0) {
  console.log(`\n✅ BACKUP COMPLET ET EXPLOITABLE.\n`);
  process.exit(0);
} else {
  console.log(`\n⛔ ${mismatches} ÉCART(S) — le backup ne reflète pas l'état actuel de la base.\n`);
  process.exit(1);
}