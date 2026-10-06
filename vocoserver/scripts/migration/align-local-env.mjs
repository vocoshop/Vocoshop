import { execFileSync } from "child_process";
import fs from "fs";
import crypto from "crypto";

/* Aligne JWT_SECRET et AGENT_JWT_SECRET de voco-web/.env.local sur les
   valeurs Railway, SANS jamais afficher ni loguer de valeur. Les autres
   cle (URLs, VERCEL_OIDC_TOKEN) sont conservees telles quelles. */
const ENV_LOCAL = process.argv[2] ?? "C:/Users/PC/Desktop/MON PROJET/voco-web/.env.local";
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);
console.log("cible : " + ENV_LOCAL);

const out = execFileSync("railway", ["variables", "--kv"], {
  cwd: "C:/Users/PC/Desktop/MON PROJET/vocoserver",
  encoding: "utf8",
  shell: true,
});
const rail = {};
for (const line of out.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0) rail[line.slice(0, i).trim()] = line.slice(i + 1);
}
for (const k of ["JWT_SECRET", "AGENT_JWT_SECRET"]) {
  if (!rail[k]) { console.log(k + " ABSENT de Railway -> action annulee"); process.exit(1); }
}

const lines = fs.readFileSync(ENV_LOCAL, "utf8").split(/\r?\n/);
const want = { JWT_SECRET: rail.JWT_SECRET, AGENT_JWT_SECRET: rail.AGENT_JWT_SECRET };
const changed = [];

for (let n = 0; n < lines.length; n++) {
  const i = lines[n].indexOf("=");
  if (i < 0) continue;
  const k = lines[n].slice(0, i).trim();
  if (!(k in want)) continue;
  const cur = lines[n].slice(i + 1).trim().replace(/^["']|["']$/g, "");
  if (cur === want[k]) { console.log(k + " : deja aligne (" + sha(cur) + ")"); continue; }
  console.log(k + " : " + sha(cur) + " -> " + sha(want[k]));
  lines[n] = k + "=" + want[k];
  changed.push(k);
}

if (changed.length) {
  fs.writeFileSync(ENV_LOCAL, lines.join("\n"), { mode: 0o600 });
  console.log("mis a jour : " + changed.join(", "));
} else {
  console.log("aucune modification");
}