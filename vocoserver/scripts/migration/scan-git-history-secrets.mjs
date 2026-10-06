import { execFileSync } from "child_process";

/* Scan exhaustif de TOUS les blobs uniques de l'historique git pour
   des secrets en dur (repo PUBLIC). Aucun contenu n'est affiche : seuls
   le motif, le chemin et le hash du blob sortent. */
const ROOT = "C:/Users/PC/Desktop/MON PROJET";

const rules = [
  { name: "mongo-uri-reelle", re: /mongodb\+srv:\/\/[^:\s"']+:[^@\s"']{6,}@/ },
  { name: "jwt-eyJ", re: /eyJ[A-Za-z0-9_\-]{20,}\.[A-Za-z0-9_\-]{10,}\.[A-Za-z0-9_\-]{10,}/ },
  { name: "aws-access-key", re: /AKIA[0-9A-Z]{16}/ },
  { name: "private-key", re: /-----BEGIN (?:RSA |EC )?PRIVATE KEY-----/ },
  { name: "google-api-key", re: /AIza[0-9A-Za-z_\-]{30,}/ },
  { name: "stripe-secret", re: /sk_live_[0-9a-zA-Z]{20,}/ },
  { name: "vercel-token", re: /\b[A-Za-z0-9_]{22,}\b.*vercel/i },
  { name: "password-literal", re: /(?:password|passwd|pwd)\s*[:=]\s*["'][^"'\s]{8,}["']/i },
  { name: "secret-literal", re: /(?:secret|token|api[_-]?key)\s*[:=]\s*["'][^"'\s]{16,}["']/i },
  { name: "railway-token", re: /railway_[A-Za-z0-9]{20,}/ },
  { name: "github-pat", re: /gh[pousr]_[A-Za-z0-9]{30,}/ },
];

const list = execFileSync("git", ["rev-list", "--objects", "--all"], { cwd: ROOT, encoding: "utf8", maxBuffer: 1024 * 1024 * 512 });
const blobs = [];
const seen = new Set();
for (const line of list.split("\n")) {
  const i = line.indexOf(" ");
  if (i < 0) continue;
  const sha = line.slice(0, i);
  const path = line.slice(i + 1);
  if (seen.has(sha)) continue;
  seen.add(sha);
  blobs.push({ sha, path });
}
console.log("blobs uniques a scanner : " + blobs.length);

/* On lit tous les blobs en un seul appel git cat-file --batch */
const child = (await import("child_process")).spawn("git", ["cat-file", "--batch"], { cwd: ROOT, maxBuffer: 1024 * 1024 * 512 });

const findings = [];
let buf = Buffer.alloc(0);
let pending = [];
let resolved = 0;

child.stdout.on("data", (chunk) => {
  buf = Buffer.concat([buf, chunk]);
  while (true) {
    /* En-tête : <sha> <type> <taille>\n */
    const nl = buf.indexOf(0x0a);
    if (nl < 0) break;
    const header = buf.slice(0, nl).toString("utf8");
    const m = header.match(/^([0-9a-f]{40}) (\w+) (\d+)$/);
    if (!m) { buf = buf.slice(nl + 1); continue; }
    const size = parseInt(m[3], 10);
    if (buf.length < nl + 1 + size + 1) break;
    const body = buf.slice(nl + 1, nl + 1 + size);
    buf = buf.slice(nl + 1 + size + 1);
    const meta = pending.shift();
    if (meta) { check(meta, body); resolved++; }
  }
  maybeFinish();
});

child.stdin.on("error", () => {});
child.on("close", maybeFinish);

function check(meta, body) {
  /* Ignore les binaires */
  if (body.includes(0)) return;
  const text = body.toString("utf8");
  for (const r of rules) {
    if (r.re.test(text)) findings.push({ rule: r.name, path: meta.path, sha: meta.sha.slice(0, 12) });
  }
}

function maybeFinish() {
  if (resolved < blobs.length) return;
  console.log("\n=== findings (" + findings.length + ") ===");
  const byRule = {};
  for (const f of findings) {
    byRule[f.rule] = byRule[f.rule] ?? [];
    byRule[f.rule].push(f);
  }
  for (const [rule, fs_] of Object.entries(byRule)) {
    console.log("  " + rule + "  (" + fs_.length + " blob(s))");
    for (const f of fs_.slice(0, 6)) console.log("      " + f.path + "  [" + f.sha + "]");
    if (fs_.length > 6) console.log("      ... +" + (fs_.length - 6));
  }
  process.exit(0);
}

for (const b of blobs) {
  pending.push(b);
  child.stdin.write(b.sha + "\n");
}
child.stdin.end();