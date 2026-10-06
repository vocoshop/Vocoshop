import { execFileSync } from "child_process";
import jwt from "jsonwebtoken";

/* Idem, mais avec redirect:"manual" pour ne jamais suivre la 307 vers
   /admin/login : on veut le status REEL renvoyé par le proxy. */
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

const ok = jwt.sign({ role: "owner", email: "verif@example.invalid", name: "Verif" }, rail.JWT_SECRET, {
  expiresIn: "10m",
});
const bad = jwt.sign({ role: "owner" }, "secret-bidon-abc", { expiresIn: "10m" });

const SITE = "https://www.vocoshop.app";
const rows = [];

async function call(label, path, cookie) {
  const headers = cookie ? { Cookie: `adminToken=${cookie}` } : {};
  const r = await fetch(SITE + path, { headers, redirect: "manual" });
  const loc = r.headers.get("location") || "";
  rows.push([label, r.status, loc]);
}

await call("/super-admin/dashboard  cookie Railway valide", "/super-admin/dashboard", ok);
await call("/super-admin/dashboard  cookie bidon          ", "/super-admin/dashboard", bad);
await call("/super-admin/dashboard  sans cookie           ", "/super-admin/dashboard", null);
await call("/admin/login            aucun                 ", "/admin/login", null);

console.log("\n=== proxy Vercel : status REEL (redirect non suivi) ===\n");
for (const [l, s, loc] of rows) {
  const verdict = s === 200 ? "ACCEPTÉ (next)" : s === 307 ? "REDIRIGÉ vers login" : "?" + s;
  console.log("  " + l.padEnd(44) + " " + s + "   " + verdict);
  if (loc) console.log("      -> " + loc);
}

console.log("\n=== lecture seule : aucun mot de passe admin utilise ===");
console.log("  jetons synthétiques signés avec le JWT_SECRET Railway");
console.log("  temp de validité : 10 minutes");