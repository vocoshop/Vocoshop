import fs from "fs";
import path from "path";
import crypto from "crypto";
import { execFileSync } from "child_process";

/* Audit des .env locaux : presence git (tracke/ignore), cles sensibles
   (empreintes SHA-256 uniquement). Aucune valeur n'est affichee. */
const ROOT = "C:/Users/PC/Desktop/MON PROJET";
const SKIP = new Set(["node_modules", ".git", ".next", "dist", "build", "android", "ios", ".vercel", "MONGO_BACKUP", "uploads"]);
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.isDirectory()) {
      if (SKIP.has(e.name)) continue;
      walk(path.join(dir, e.name), out);
    } else if (/^\.env(\.|$)/.test(e.name) && e.name !== ".env.example") {
      out.push(path.join(dir, e.name));
    }
  }
  return out;
}

function gitInfo(abs) {
  const rel = path.relative(ROOT, abs).replace(/\\/g, "/");
  let tracked = false;
  try {
    execFileSync("git", ["ls-files", "--error-unmatch", "--", rel], { cwd: ROOT, stdio: "pipe" });
    tracked = true;
  } catch {}
  let ignored = false;
  try {
    execFileSync("git", ["check-ignore", "-q", "--", rel], { cwd: ROOT, stdio: "pipe" });
    ignored = true;
  } catch {}
  return { rel, tracked, ignored };
}

const files = walk(ROOT).sort();
console.log("fichiers .env trouves : " + files.length + "\n");

for (const abs of files) {
  const { rel, tracked, ignored } = gitInfo(abs);
  const flag = tracked ? "!! TRACKED !!" : ignored ? "ignore" : "NON IGNORE (risque)";
  console.log(rel.padEnd(40) + " " + flag);

  const raw = fs.readFileSync(abs, "utf8");
  const lines = raw.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  for (const line of lines) {
    const i = line.indexOf("=");
    if (i < 0) continue;
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim().replace(/^["']|["']$/g, "");
    if (/SECRET|PASSWORD|TOKEN|KEY|MONGO_URI|PRIVATE/i.test(k)) {
      console.log("      " + k.padEnd(26) + (v ? sha(v) + " (" + v.length + " car.)" : "VIDE"));
    }
  }
  console.log("");
}