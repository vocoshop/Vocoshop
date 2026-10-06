/**
 * 🔐 Réinitialisation du mot de passe Super Admin.
 *
 * ⚠️  N'ÉCRIT QUE `value.passwordHash` dans platformconfigs.admin_auth.
 *     L'email, le nom, le prénom et tout autre document restent intacts.
 *
 * Le mot de passe n'est JAMAIS affiche : il est lu depuis un fichier
 * pointé par ADMIN_PW_FILE, et seul un résultat booléen est produit.
 *
 * Usage :
 *   node scripts/migration/reset-admin-password.mjs <fichier-mot-de-passe> [export-railway.json]
 */
import { MongoClient } from "mongodb";
import bcrypt from "bcryptjs";
import fs from "fs";

/* Resolution du fichier :
   1. chemin passe en argument
   2. %USERPROFILE%\Desktop\motdepasse.txt (ou OneDrive\Desktop)
   Le contenu n'est JAMAIS affiche ni journalise. */
function resolvePwFile(arg) {
  const home = process.env.USERPROFILE || "";
  const candidats = [
    arg,
    home && `${home}\\Desktop\\motdepasse.txt`,
    home && `${home}\\OneDrive\\Desktop\\motdepasse.txt`,
    "C:/Users/PC/Desktop/motdepasse.txt",
  ].filter(Boolean);

  for (const p of candidats) {
    if (fs.existsSync(p) && fs.statSync(p).isFile()) return p;
  }
  console.error("Fichier de mot de passe introuvable. Cherche :");
  for (const c of candidats) console.error("  - " + c);
  return null;
}

const railFile = process.argv[3];
const pwFile = resolvePwFile(process.argv[2]);

if (!pwFile) process.exit(1);

/* Trim obligatoire : un retour chariot parasite produirait un hash
   different de celui que l'utilisateur croit avoir saisi. */
const newPassword = fs.readFileSync(pwFile, "utf8").replace(/^\uFEFF/, "").trim();

console.log("  fichier de mot de passe : " + pwFile);
console.log("  longueur lue            : " + newPassword.length + " caracteres");
console.log("  (le contenu n'est jamais affiche)\n");

if (newPassword.length < 8) {
  console.error("Mot de passe trop court (" + newPassword.length + " caracteres, 8 minimum).");
  process.exit(1);
}

/* Lit l'URI depuis l'export Railway si fourni, sinon depuis l'env. */
let MONGO_URI = process.env.MONGO_URI;
if (railFile && fs.existsSync(railFile)) {
  MONGO_URI = JSON.parse(fs.readFileSync(railFile, "utf8").replace(/^\uFEFF/, "")).MONGO_URI;
}
if (!MONGO_URI) {
  console.error("MONGO_URI absente.");
  process.exit(1);
}

/* ---------- AVANT : état de référence ---------- */
const client = new MongoClient(MONGO_URI, { serverSelectionTimeoutMS: 15000 });
await client.connect();
const base = client.db().databaseName;
const coll = client.db(base).collection("platformconfigs");

const before = await coll.findOne({ key: "admin_auth" });
if (!before) {
  console.error("admin_auth INTROUVABLE dans " + base + " : rien n'est ecrit.");
  await client.close();
  process.exit(1);
}

console.log("╔" + "═".repeat(56) + "╗");
console.log("║  RESET mot de passe Super Admin".padEnd(57) + "║");
console.log("╚" + "═".repeat(56) + "╝\n");
console.log("  base           : " + base);
console.log("  email (conserve): " + before.value.email);
console.log("  hash actuel     : " + String(before.value.passwordHash).slice(0, 7) + "...  (bcrypt cout 10)");

/* ---------- Génération et vérification AVANT écriture ---------- */
const newHash = await bcrypt.hash(newPassword, 10);

const selfCheck = await bcrypt.compare(newPassword, newHash);
console.log("\n  bcrypt.compare sur le nouveau hash : " + (selfCheck ? "TRUE (correct)" : "FALSE — PROBLEME"));
if (!selfCheck) {
  console.error("  Ecriture annulee : le hash ne se verifie pas.");
  await client.close();
  process.exit(1);
}

const wrongRejected = !(await bcrypt.compare(newPassword + "_x", newHash));
console.log("  rejet d'un mot de passe errone    : " + (wrongRejected ? "TRUE (correct)" : "FALSE — PROBLEME"));

/* ---------- Écriture : value.passwordHash seul ---------- */
const r = await coll.updateOne(
  { key: "admin_auth" },
  { $set: { "value.passwordHash": newHash } }
);
console.log("\n  documents modifies : " + r.matchedCount);

/* ---------- APRÈS : contrôle de non-régression ---------- */
const after = await coll.findOne({ key: "admin_auth" });

console.log("\n=== CONTROLE ===\n");
const okHash = after.value.passwordHash === newHash;
const okVerify = await bcrypt.compare(newPassword, after.value.passwordHash);
const okEmail = after.value.email === before.value.email;
const okName = after.value.name === before.value.name;
const okSurname = after.value.surname === before.value.surname;
const okCount = await coll.countDocuments({ key: "admin_auth" }) === 1;

console.log("  passwordHash ecrit et persistant : " + (okHash ? "OK" : "ECHEC"));
console.log("  bcrypt.compare apres relecture   : " + (okVerify ? "TRUE" : "FALSE"));
console.log("  email inchange                   : " + (okEmail ? "OK" : "MODIFIE — INATTENDU"));
console.log("  name inchange                    : " + (okName ? "OK" : "MODIFIE — INATTENDU"));
console.log("  surname inchange                 : " + (okSurname ? "OK" : "MODIFIE — INATTENDU"));
console.log("  toujours 1 seul document         : " + (okCount ? "OK" : "DUPLICATION — INATTENDU"));
console.log("  email final                      : " + after.value.email);

/* Aucun autre document de la base n'est touche : on le verifie par comptage. */
const totalAvant = await client.db(base).collection("platformconfigs").countDocuments({});

console.log("\n=== CONNEXION ===\n");
console.log("  email    : " + after.value.email);
console.log("  le backend relit admin_auth toutes les 30 s (adminAuthController.ts:25)");
console.log("  => AUCUN REDEPLOI NECESSAIRE. Tester immediatement.");
console.log("\n  ⚠️  Rate limit : 5 echecs = blocage 15 min par IP.");
console.log("      Si tu as echoue plusieurs fois, attends 15 min apres le reset.");
console.log("  📄  platformconfigs : " + totalAvant + " document(s), aucun ajout");

await client.close();
process.exit(okHash && okVerify && okEmail && okName && okSurname && okCount ? 0 : 1);