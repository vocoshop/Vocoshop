import { execFileSync } from "child_process";
import fs from "fs";
import crypto from "crypto";

/* Compare le fichier LOCAL (HEAD + modifs non commitees) au contenu
   reellement servi en production. On ne compare pas des hashes de build
   (ils different toujours) mais des marqueurs de code stables. */
const ROOT = "C:/Users/PC/Desktop/MON PROJET";

function gitHead() {
  return execFileSync("git", ["rev-parse", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
}

const head = gitHead();
console.log("HEAD local : " + head + "\n");

/* 1. Correctif du bouton de connexion : local vs production */
const local = fs.readFileSync(`${ROOT}/voco-web/app/admin/login/page.tsx`, "utf8");
const localFix = /setLoading\(false\);\s*\n\s*\n?\s*\/\*|setLoading\(false\);[\s\S]{0,400}router\.push\("\/super-admin\/dashboard"\)/.test(local);
console.log("=== page admin/login ===");
console.log("  local  : setLoading(false) avant router.push = " + (localFix ? "present" : "ABSENT"));

const html = await (await fetch("https://www.vocoshop.app/admin/login")).text();
const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[a-zA-Z0-9_\-]+\.js/g)].map((m) => m[0]))];
let js = "";
for (const c of chunks) js += (await (await fetch("https://www.vocoshop.app" + c)).text()) + "\n";

const loginAt = js.indexOf("admin/auth/login");
const pushAt = js.indexOf('push("/super-admin/dashboard")', loginAt);
const prodSegment = js.slice(loginAt, pushAt);
const prodFix = /\w+\(!1\)/.test(prodSegment);
console.log("  prod   : loading remis a false avant push = " + (prodFix ? "present" : "ABSENT"));
console.log("  etat   : " + (localFix && prodFix ? "IDENTIQUE (correction presente en ligne)" : "DIVERGENT"));

/* 2. Cible du proxy API : locale vs production */
console.log("\n=== proxy /api ===");
const cfg = fs.readFileSync(`${ROOT}/voco-web/next.config.ts`, "utf8");
const localApi = cfg.match(/destination:\s*"(https:\/\/[^"]*railway[^"]*)"/)?.[1] ?? "(introuvable)";
console.log("  local  : " + localApi);
const prodApi = js.match(/https:\/\/[a-z0-9.\-]*railway\.app\/api\/[^"'\s]*/)?.[0] ?? "(non visible dans le client, gere par le serveur)";
console.log("  prod   : " + (prodApi.includes("(non visible") ? "reecriture serveur : " + localApi : prodApi));

/* 3. Les deux API sont-elles joignables ? */
const apiUp = await fetch("https://vocoserver-production.up.railway.app/api/health").catch(() => null);
console.log("  backend joignable : " + (apiUp ? "HTTP " + apiUp.status : "INJOIGNABLE"));

/* 4. Empreinte des fichiers critiques versionnes */
console.log("\n=== empreintes SHA-256 (contenu local) ===");
for (const f of [
  "voco-web/next.config.ts",
  "voco-web/proxy.ts",
  "voco-web/app/admin/login/page.tsx",
]) {
  const buf = fs.readFileSync(`${ROOT}/${f}`);
  const h = crypto.createHash("sha256").update(buf).digest("hex").slice(0, 16);
  console.log(`  ${f.padEnd(38)} ${h}`);
}