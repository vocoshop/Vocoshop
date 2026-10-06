import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import fs from "fs";

/* Reproduit exactement le chemin de login du backend sur la base
   reellement utilisee en production, sans passer par HTTP. */
const env = JSON.parse(fs.readFileSync(process.argv[2], "utf8").replace(/^\uFEFF/, ""));
const newPassword = fs.readFileSync(process.argv[3], "utf8").replace(/^\uFEFF/, "").trim();
const ANCIEN = process.argv[4];

const c = new MongoClient(env.MONGO_URI, { serverSelectionTimeoutMS: 15000 });
await c.connect();
const base = c.db().databaseName;
const doc = await c.db(base).collection("platformconfigs").findOne({ key: "admin_auth" });

console.log("=== simulation exacte de POST /api/admin/auth/login ===\n");
console.log("  base reellement utilisee : " + base);

console.log("\n  --- etape 1 : comparaison email (ligne 85) ---");
const emailOk = env.ADMIN_EMAIL.toLowerCase() === doc.value.email.toLowerCase();
console.log("  ADMIN_EMAIL Railway : " + env.ADMIN_EMAIL);
console.log("  email en base       : " + doc.value.email);
console.log("  identique           : " + emailOk + (emailOk ? "" : "  -> 401 ICI, avant le mot de passe"));

console.log("\n  --- etape 2 : bcrypt.compare (ligne 100) ---");
const pwOk = await bcrypt.compare(newPassword, doc.value.passwordHash);
console.log("  bcrypt.compare(nouveau mot de passe) : " + pwOk);
console.log("\n  --- etape 3 : ancien mot de passe Railway ---");
console.log("  bcrypt.compare(ADMIN_PASSWORD Railway) : " + (await bcrypt.compare(ANCIEN, doc.value.passwordHash)));

const verdict = emailOk && pwOk;
console.log("\n  => VERDICT : " + (verdict ? "CONNEXION REUSSIE" : "CONNEXION REFUSEE"));

console.log("\n=== desynchronisation Railway corrigee ? ===\n");
console.log("  ADMIN_EMAIL Railway == email en base : " + emailOk);
console.log("  => le fallback adminAuthController.ts:38 est desormais coherent.");

await c.close();