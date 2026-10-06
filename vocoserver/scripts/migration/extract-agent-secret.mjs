import { execFileSync } from "child_process";
import fs from "fs";
import crypto from "crypto";

/* Recupere AGENT_JWT_SECRET depuis Railway et l'ecrit dans un fichier
   temporaire. La valeur n'est JAMAIS affichee : seule une empreinte
   SHA-256 (12 premieres caracteres) sort, pour verifier sans fuiter. */
let out;
try {
  out = execFileSync("railway", ["variables", "--kv"], {
    cwd: "C:/Users/PC/Desktop/MON PROJET/vocoserver",
    encoding: "utf8",
    shell: true,
  });
} catch (e) {
  console.log("ERREUR lecture variables Railway");
  process.exit(1);
}

const found = {};
for (const line of out.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i === -1) continue;
  found[line.slice(0, i).trim()] = line.slice(i + 1);
}

if (!found.AGENT_JWT_SECRET) {
  console.log("AGENT_JWT_SECRET ABSENT de Railway -> rien a recopier");
  process.exit(2);
}

const s = found.AGENT_JWT_SECRET;
fs.writeFileSync("C:/Users/PC/AppData/Local/Temp/opencode/agent_jwt_secret.txt", s, { mode: 0o600 });
const fp = crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);
console.log("AGENT_JWT_SECRET Railway : " + s.length + " car., empreinte " + fp + " (valeur masquee)");
console.log("  longueur >= 32 : " + (s.length >= 32 ? "ok" : "TROP COURT"));
console.log("  saut de ligne  : " + (/\s/.test(s) ? "OUI (probleme)" : "non"));
console.log("  guillemet      : " + (/["']/.test(s) ? "OUI (probleme)" : "non"));