import fs from "fs";
import crypto from "crypto";
import { execFileSync } from "child_process";

/* Verifie si ADMIN_PASSWORD local est le meme que Railway (empreintes
   seulement), et si le hash admin_auth existe en base LOCALE (ancien
   cluster) : si oui, ADMIN_PASSWORD local est inutile (fallback jamais
   utilise). Lecture seule, aucune ecriture. */
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);

function envVal(file, key) {
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (line.startsWith(key + "=")) return line.slice(key.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return null;
}

const localPw = envVal("C:/Users/PC/Desktop/MON PROJET/vocoserver/.env", "ADMIN_PASSWORD");
const localUri = envVal("C:/Users/PC/Desktop/MON PROJET/vocoserver/.env", "MONGO_URI");

const out = execFileSync("railway", ["variables", "--kv"], {
  cwd: "C:/Users/PC/Desktop/MON PROJET/vocoserver",
  encoding: "utf8",
  shell: true,
});
const rail = {};
for (const l of out.split(/\r?\n/)) {
  const i = l.indexOf("=");
  if (i > 0) rail[l.slice(0, i).trim()] = l.slice(i + 1);
}

console.log("ADMIN_PASSWORD");
console.log("  local   : " + (localPw ? sha(localPw) + " (" + localPw.length + " car.)" : "ABSENTE"));
console.log("  Railway : " + (rail.ADMIN_PASSWORD ? sha(rail.ADMIN_PASSWORD) + " (" + rail.ADMIN_PASSWORD.length + " car.)" : "ABSENTE"));
console.log("  identiques : " + (localPw && rail.ADMIN_PASSWORD ? localPw === rail.ADMIN_PASSWORD : false));
console.log("\nMONGO_URI locale : host=" + (localUri?.match(/@([^/?]+)/)?.[1] ?? "?"));

if (!localUri) { console.log("pas de URI locale"); process.exit(0); }

/* Lecture seule : existe-t-il un hash admin_auth dans la base LOCALE ? */
const { MongoClient } = await import("mongodb");
const bcrypt = (await import("bcryptjs")).default;
const c = new MongoClient(localUri, { serverSelectionTimeoutMS: 12000 });
try {
  await c.connect();
  const db = c.db().databaseName;
  const doc = await c.db(db).collection("platformconfigs").findOne({ key: "admin_auth" });
  console.log("\nbase locale      : " + db);
  console.log("admin_auth       : " + (doc ? "present (hash " + String(doc.value?.passwordHash).slice(0, 7) + "...)" : "ABSENT"));
  if (doc?.value?.passwordHash && localPw) {
    const ok = await bcrypt.compare(localPw, doc.value.passwordHash);
    console.log("local==hash base : " + ok + "  -> ADMIN_PASSWORD local " + (ok ? "inutile (fallback jamais utilise)" : "DIFFERENT du hash"));
  } else if (!doc) {
    console.log("-> hash absent    : ADMIN_PASSWORD local NECESSAIRE en dev local");
  }
} catch (e) {
  console.log("\nbase locale inaccessible : " + e.message.slice(0, 80));
} finally {
  await c.close().catch(() => {});
}