import fs from "fs";
import crypto from "crypto";
import path from "path";

const ROOT = "C:/Users/PC/Desktop/MON PROJET";
const files = [
  "voco-web/.env.local",
  "voco-web/.env.production",
  "vocoserver/.env",
  "vocoserver/.env.production",
  "vocoserver/.env.render",
  "vocoshop/.env",
  "vocoshop/.env.production",
];
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);

console.log("fichier                          nb cle   cles sensibles/interessantes");
for (const rel of files) {
  const p = path.join(ROOT, rel);
  if (!fs.existsSync(p)) { console.log(rel.padEnd(34) + " ABSENT"); continue; }
  const raw = fs.readFileSync(p, "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  const keys = [];
  const detail = [];
  for (const line of lines) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    keys.push(k);
    if (/SECRET|PASSWORD|TOKEN|MONGO_URI/i.test(k)) {
      detail.push(k + "=" + (v.length ? sha(v) + "(" + v.length + "o)" : "VIDE"));
    }
  }
  console.log(rel.padEnd(34) + String(keys.length).padStart(4) + "   " + detail.join("; "));
}