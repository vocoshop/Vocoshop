import { execFileSync } from "child_process";
import fs from "fs";
import crypto from "crypto";

/* Compare les JWT_SECRET par EMPREINTE, jamais par valeur.
   Sources : Railway, .env.local (Vercel pull), et les valeurs inaccessibles
   de l'env Vercel Production (verifiees fonctionnellement ensuite). */

function railVars() {
  const out = execFileSync("railway", ["variables", "--kv"], {
    cwd: "C:/Users/PC/Desktop/MON PROJET/vocoserver",
    encoding: "utf8",
    shell: true,
  });
  const v = {};
  for (const line of out.split(/\r?\n/)) {
    const i = line.indexOf("=");
    if (i > 0) v[line.slice(0, i).trim()] = line.slice(i + 1);
  }
  return v;
}

function envLocal() {
  const p = "C:/Users/PC/Desktop/MON PROJET/voco-web/.env.local";
  if (!fs.existsSync(p)) return {};
  const v = {};
  for (const line of fs.readFileSync(p, "utf8").split(/\r?\n/)) {
    const m = line.match(/^([A-Za-z0-9_]+)=(.*)$/);
    if (m) v[m[1]] = m[2].trim().replace(/^["']|["']$/g, "");
  }
  return v;
}

const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex").slice(0, 12);

const rail = railVars();
const loc = envLocal();

console.log("=== empreintes SHA-256 (12 premiers caracteres) ===\n");
for (const key of ["JWT_SECRET", "AGENT_JWT_SECRET"]) {
  const r = rail[key];
  const l = loc[key];
  console.log(key);
  console.log("  Railway        " + (r ? sha(r) + "  (" + r.length + " car.)" : "ABSENT"));
  console.log("  .env.local     " + (l ? sha(l) + "  (" + l.length + " car.)" : "ABSENT"));
  if (r && l) {
    console.log("  correspondance : " + (r === l ? "OUI - identiques" : "NON - DIVERGENCE"));
  } else {
    console.log("  correspondance : non evaluable");
  }
  console.log("");
}

/* Verifie que le .env.local ne stocke pas un mot de passe MongoDB
   ou un secret admin en clair a cote. */
console.log("=== cles presentes dans .env.local ===");
for (const k of Object.keys(loc)) {
  const risky = /MONGO|PASSWORD|ADMIN|SECRET|KEY/i.test(k);
  console.log("  " + k + (risky ? "   <-- sensible" : ""));
}