import { execFileSync } from "child_process";
import fs from "fs";

/* Recupere JWT_SECRET depuis Railway et l'ecrit dans un fichier temporaire.
   La valeur n'est jamais affichee dans la sortie console. */
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
  const k = line.slice(0, i).trim();
  const v = line.slice(i + 1);
  found[k] = v;
}

const names = Object.keys(found).filter((k) => k.includes("JWT"));
console.log("variables JWT trouvees sur Railway : " + (names.length ? names.join(", ") : "aucune"));

if (!found.JWT_SECRET) {
  console.log("JWT_SECRET ABSENT de Railway -> rien a recopier");
  process.exit(2);
}

fs.writeFileSync("C:/Users/PC/AppData/Local/Temp/opencode/jwt_secret.txt", found.JWT_SECRET, { mode: 0o600 });
console.log("JWT_SECRET copie : " + found.JWT_SECRET.length + " caracteres (valeur masquee)");

/* Verification de coherence : le secret doit etre assez long et sans
   guillemets/caracteres suspects qui casseraient un env Vercel. */
const s = found.JWT_SECRET;
console.log("  longueur " + s.length + " (attendu >= 32) : " + (s.length >= 32 ? "ok" : "TROP COURT"));
console.log("  contient un saut de ligne : " + (/\s/.test(s) ? "OUI (probleme)" : "non"));
console.log("  contient un guillemet : " + (/["']/.test(s) ? "OUI (probleme)" : "non"));