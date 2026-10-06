/**
=====================================================
♻️ RESTORE MongoDB — depuis un backup .bson
=====================================================
⚠️  ÉCRITURE sur la base cible. Ne jamais cibler "test".

Usage :
  node restore-db.mjs vocoshop-prod "C:\...\backups\test-....bson"

Sécurité : refuse de démarrer si la cible existe déjà ET est non vide,
sauf --force-empty explicite.
=====================================================
*/
import { MongoClient } from "mongodb";
import { BSON } from "bson";
import fs from "fs";
import path from "path";

const basename = path.basename;

const uri = process.env.MONGO_URI;
const target = process.argv[2];
const file = process.argv[3];

if (!uri || !target || !file) {
  console.error("Usage : node restore-db.mjs <baseCible> <fichier.bson>");
  process.exit(1);
}

/* Garde-fous : on ne restaure JAMAIS dans test. */
if (target === "test") {
  console.error("⛔ REFUS : restaurer dans 'test' détruirait la production courante.");
  process.exit(1);
}

if (!fs.existsSync(file)) {
  console.error(`⛔ Fichier introuvable : ${file}`);
  process.exit(1);
}

function uriFor(db) {
  const scheme = uri.startsWith("mongodb+srv://") ? "mongodb+srv" : "mongodb";
  const auth = uri.includes("@") ? uri.slice(0, uri.indexOf("@")).split("/")[2] + "@" : "";
  const host = uri.slice(uri.indexOf("@") + 1).split("/")[0];
  return `${scheme}://${auth}${host}/${encodeURIComponent(db)}?appName=vocoshop-restore`;
}

const client = new MongoClient(uriFor(target), { serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(target);

/* Pré-lecture du backup pour connaître les collections à créer. */
const buf = fs.readFileSync(file);
const docs = [];
let offset = 0;
while (offset < buf.length) {
  const size = buf.readInt32LE(offset);
  docs.push(BSON.deserialize(buf.subarray(offset, offset + size)));
  offset += size;
}

/* Le backup est un flux BSON plat, écrit dans l'ordre du manifeste.
   On le relit séquentiellement avec un curseur unique partagé. */

/* Le backup est « plat » : on réassocie via le manifeste si présent. */
const manifestPath = file.replace(/\.bson$/, ".manifest.json");
if (!fs.existsSync(manifestPath)) {
  console.error("⛔ Manifeste introuvable :", manifestPath);
  console.error("   Le backup n'est pas exploitable sans son manifeste.");
  process.exit(1);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

console.log(`Cible    : ${target}`);
console.log(`Backup   : ${basename(file)}`);
console.log(`Backup de: ${manifest.dbName}`);
console.log(`Total    : ${manifest.total} documents\n`);

const existing = await db.listCollections({}, { nameOnly: true }).toArray();
for (const c of existing) {
  const n = await db.collection(c.name).countDocuments({});
  if (n > 0) {
    console.error(`⛔ REFUS : la base '${target}' contient déjà des données (${c.name}: ${n} docs).`);
    console.error("   Videz-la explicitement avant un restore, ou choisissez une autre base.");
    await client.close();
    process.exit(1);
  }
}

console.log("Cible vide : OK\n");

let inserted = 0;
let cursor = 0;

for (const entry of manifest.collections) {
  if (entry.count === 0) continue;

  /* On recrée la collection puis on insère. */
  try {
    await db.createCollection(entry.collection);
  } catch {
    /* existe déjà : ignoré */
  }

  /* Curseur PARTAGÉ : on lit exactement entry.count blocs consécutifs. */
  const slice = [];
  for (let n = 0; n < entry.count; n++) {
    if (cursor + 4 > buf.length) {
      console.error(`⛔ Backup tronqué : il manque des documents pour '${entry.collection}'.`);
      await client.close();
      process.exit(1);
    }
    const size = buf.readInt32LE(cursor);
    slice.push(BSON.deserialize(buf.subarray(cursor, cursor + size)));
    cursor += size;
  }

  if (slice.length) await db.collection(entry.collection).insertMany(slice, { ordered: false });
  inserted += slice.length;
  console.log(`  ${entry.collection.padEnd(26)} ${String(slice.length).padStart(8)} / ${entry.count}`);
}

if (cursor !== buf.length) {
  console.warn(`⚠️  ${buf.length - cursor} octet(s) non consommés : le backup contient des données absentes du manifeste.`);
}

await client.close();
console.log(`\n✅ ${inserted} documents restaurés dans '${target}'.`);
console.log("   LES INDEX NE SONT PAS COPIÉS : lancez ensuite le script d'indexation.");