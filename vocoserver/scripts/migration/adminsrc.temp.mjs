import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import fs from "fs";

/* Les valeurs sont lues de l'export Railway. Elles ne sont JAMAIS
   affichees : seuls des booleens sortent d'ici. */
let raw = fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, "");
const env = JSON.parse(raw);

console.log("=== ce que voit le backend au demarrage ===\n");
console.log("  ADMIN_EMAIL    : " + env.ADMIN_EMAIL);
console.log("  ADMIN_PASSWORD : " + (env.ADMIN_PASSWORD ? "definie (" + env.ADMIN_PASSWORD.length + " car.)" : "ABSENTE"));
console.log("  MONGO_URI a un nom de base : " + /@[^/?]+\/[^/?]+/.test(env.MONGO_URI || ""));

const c = new MongoClient(env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
await c.connect();
const base = c.db().databaseName;
console.log("  base cible     : " + base);

const doc = await c.db(base).collection("platformconfigs").findOne({ key: "admin_auth" });
if (!doc) { console.log("\n  admin_auth INTROUVABLE."); await c.close(); process.exit(1); }

console.log("\n=== admin_auth en base ===\n");
console.log("  email en base : " + doc.value.email);
console.log("  hash en base  : " + String(doc.value.passwordHash).slice(0, 7) + "...  bcrypt cout 10");

console.log("\n=== source effective (adminAuthController.ts:38) ===\n");
const dbWin = !!(doc.value.email && doc.value.passwordHash);
console.log("  admin_auth exploitable en base : " + dbWin);
console.log("  source utilisee               : " + (dbWin ? "LE HASH EN BASE" : "fallback ADMIN_PASSWORD"));
console.log("  ADMIN_PASSWORD Railway         : " + (dbWin ? "IGNORE" : "utilise"));

console.log("\n=== diagnostic de ton echec ===\n");
const emailOk = env.ADMIN_EMAIL?.toLowerCase() === doc.value.email.toLowerCase();
const pwOk = await bcrypt.compare(env.ADMIN_PASSWORD || "", doc.value.passwordHash);
console.log("  [1] email Railway : " + env.ADMIN_EMAIL);
console.log("      email en base : " + doc.value.email);
console.log("      identiques    : " + emailOk + (emailOk ? "" : "   <-- REJET ICI, avant le mot de passe"));
console.log("  [2] bcrypt.compare(ADMIN_PASSWORD Railway, hash base) : " + pwOk);

await c.close();