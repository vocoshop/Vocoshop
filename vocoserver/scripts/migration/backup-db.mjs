/**
=====================================================
📦 SAUVEGARDE MongoDB — LECTURE SEULE
=====================================================
N'écrit jamais sur le cluster source. Produit un BSON unique.

Usage :
  node backup-db.mjs test                → C:\...\backups\test-<timestamp>.bson
=====================================================
*/
import { MongoClient } from "mongodb";
import { BSON } from "bson";
import fs from "fs";
import path from "path";

const uri = process.env.MONGO_URI;
const dbName = process.argv[2];

if (!uri || !dbName) {
  console.error("Usage : node backup-db.mjs <base>");
  console.error("MONGO_URI doit être défini.");
  process.exit(1);
}

const OUT_DIR = path.join(process.cwd(), "backups");
if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const outFile = path.join(OUT_DIR, `${dbName}-${stamp}.bson`);

function uriFor(db) {
  const scheme = uri.startsWith("mongodb+srv://") ? "mongodb+srv" : "mongodb";
  const auth = uri.includes("@") ? uri.slice(0, uri.indexOf("@")).split("/")[2] + "@" : "";
  const host = uri.slice(uri.indexOf("@") + 1).split("/")[0];
  return `${scheme}://${auth}${host}/${encodeURIComponent(db)}?appName=vocoshop-backup`;
}

const client = new MongoClient(uriFor(dbName), { serverSelectionTimeoutMS: 20000 });
await client.connect();
const db = client.db(dbName);

const cols = (await db.listCollections({}, { nameOnly: true }).toArray())
  .map((c) => c.name)
  .filter((n) => !n.startsWith("system."))
  .sort();

console.log(`Source : ${dbName}`);
console.log(`Backup : ${outFile}\n`);

const stream = fs.createWriteStream(outFile);
let grandTotal = 0;
const manifest = [];

for (const name of cols) {
  const count = await db.collection(name).countDocuments({});
  let written = 0;

  const cursor = db.collection(name).find({});
  for await (const doc of cursor) {
    stream.write(BSON.serialize(doc));
    written++;
  }

  grandTotal += written;
  manifest.push({ collection: name, count });
  console.log(`  ${name.padEnd(26)} ${String(written).padStart(8)} / ${count}`);
}

await new Promise((r) => stream.end(r));
await client.close();

fs.writeFileSync(
  path.join(OUT_DIR, `${dbName}-${stamp}.manifest.json`),
  JSON.stringify({ dbName, takenAt: new Date().toISOString(), total: grandTotal, collections: manifest }, null, 2)
);

const size = fs.statSync(outFile).size;
console.log(`\n✅ ${grandTotal} documents — ${(size / 1048576).toFixed(2)} Mo`);
console.log(`   ${outFile}`);