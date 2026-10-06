import fs from "fs";

/* Nettoyage de vocoserver/.env : suppression des cles redondantes/mortes.
   Seules les CLES supprimees sont affichees, jamais de valeurs. */
const FILE = "C:/Users/PC/Desktop/MON PROJET/vocoserver/.env";
const REMOVE = ["SMTP_FROM", "ADMIN_PASSWORD"];

const raw = fs.readFileSync(FILE, "utf8");
const eol = raw.includes("\r\n") ? "\r\n" : "\n";
const lines = raw.split(/\r?\n/);

const kept = [];
const removed = [];
for (const line of lines) {
  const t = line.trim();
  const i = t.indexOf("=");
  const key = i > 0 ? t.slice(0, i).trim() : null;
  if (key && REMOVE.includes(key) && !t.startsWith("#")) {
    removed.push(key);
    continue;
  }
  kept.push(line);
}

fs.writeFileSync(FILE, kept.join(eol), { mode: 0o600 });
console.log("cible  : vocoserver/.env");
console.log("supprimes : " + (removed.length ? removed.join(", ") : "aucune"));
console.log("restant   : " + kept.filter((l) => l.trim() && !l.trim().startsWith("#") && l.includes("=")).length + " cles");