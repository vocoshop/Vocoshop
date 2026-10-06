import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";

/* Compare les cles de vocoserver/.env avec celles reellement lues via
   process.env dans src/ et scripts/. Seules les CLES sortent (pas de
   valeurs) : on cherche les cles mortes a supprimer. */
const ROOT = "C:/Users/PC/Desktop/MON PROJET";
const SRC = ROOT + "/vocoserver";

const envKeys = fs
  .readFileSync(SRC + "/.env", "utf8")
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#") && l.includes("="))
  .map((l) => l.slice(0, l.indexOf("=")).trim());

/* Variables injectees par la plateforme (Railway/Vercel) ou lancers */
const PLATFORM = ["NODE_ENV", "PORT", "HOSTNAME", "RAILWAY_ENVIRONMENT_NAME", "RAILWAY_PROJECT_ID", "RAILWAY_SERVICE_NAME", "RAILWAY_DEPLOYMENT_ID", "RAILWAY_GIT_COMMIT_SHA", "RAILWAY_GIT_BRANCH", "RAILWAY_PUBLIC_DOMAIN", "RENDER", "CI", "HOME", "PATH", "VERCEL"];

function usedKeys(dir, out = new Set()) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) { usedKeys(path.join(dir, e.name), out); continue; }
    if (!/\.(ts|js|mjs|cjs)$/.test(e.name)) continue;
    const txt = fs.readFileSync(path.join(dir, e.name), "utf8");
    for (const m of txt.matchAll(/process\.env\.([A-Z0-9_]+)/g)) out.add(m[1]);
    for (const m of txt.matchAll(/process\.env\[\s*["']([A-Z0-9_]+)["']\s*\]/g)) out.add(m[1]);
    /* destructuring : const { FOO, BAR } = process.env */
    for (const m of txt.matchAll(/(?:const|let|var)\s*\{([^}]+)\}\s*=\s*process\.env/g)) {
      for (const k of m[1].split(",")) {
        const name = k.split(":")[0].trim().replace(/[^\w]/g, "");
        if (/^[A-Z0-9_]+$/.test(name)) out.add(name);
      }
    }
  }
  return out;
}

const used = usedKeys(SRC + "/src");
usedKeys(SRC + "/scripts", used);
usedKeys(SRC + "/__tests__", used);

const dead = envKeys.filter((k) => !used.has(k) && !PLATFORM.includes(k));
console.log("cles dans vocoserver/.env : " + envKeys.length);
console.log("lues par le code          : " + envKeys.filter((k) => used.has(k)).length);
console.log("\ncles JAMAIS lues (candidats suppression) : " + dead.length);
for (const k of dead) console.log("  " + k);