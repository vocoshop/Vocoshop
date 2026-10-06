import fs from "fs";
import jwt from "jsonwebtoken";

/* Test fonctionnel, lecture seule : chaque maillon de la chaine JWT est
   verifie par emission d'un jeton SYNTHETIQUE signe avec la valeur
   Railway. Aucun mot de passe admin n'est utilise, aucune ecriture. */
const ROOT = "C:/Users/PC/Desktop/MON PROJET";

const rail = {};
const { execFileSync } = await import("child_process");
const out = execFileSync("railway", ["variables", "--kv"], {
  cwd: ROOT + "/vocoserver",
  encoding: "utf8",
  shell: true,
});
for (const line of out.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0) rail[line.slice(0, i).trim()] = line.slice(i + 1);
}

const adminToken = jwt.sign(
  { role: "owner", email: "verification@example.invalid", name: "Verification" },
  rail.JWT_SECRET,
  { expiresIn: "10m" },
);
const badToken = jwt.sign({ role: "owner" }, "secret-bidon-abc", { expiresIn: "10m" });

const SITE = "https://www.vocoshop.app";
const API = "https://vocoserver-production.up.railway.app";
const results = [];

async function probe(label, url, headers = {}, redirect = "follow") {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers, redirect });
    const ms = Date.now() - t0;
    const loc = r.headers.get("location") || "";
    results.push([label, r.status, ms, loc]);
    return r;
  } catch (e) {
    results.push([label, "ERR", 0, String(e.message)]);
    return null;
  }
}

console.log("=== 1. Le PROXY Vercel accepte-t-il un jeton signe Railway ? ===\n");
await probe("GET /super-admin/dashboard (cookie Railway)", `${SITE}/super-admin/dashboard`, { Cookie: `adminToken=${adminToken}` });
await probe("GET /super-admin/dashboard (cookie bidon)   ", `${SITE}/super-admin/dashboard`, { Cookie: `adminToken=${badToken}` });
await probe("GET /super-admin/dashboard (sans cookie)    ", `${SITE}/super-admin/dashboard`);

console.log("\n=== 2. Le BACKEND accepte-t-il le meme jeton (Bearer) ? ===\n");
await probe("GET /api/admin/stats (Bearer Railway)", `${API}/api/admin/stats`, { Authorization: `Bearer ${adminToken}` });
await probe("GET /api/admin/stats (Bearer bidon)   ", `${API}/api/admin/stats`, { Authorization: `Bearer ${badToken}` });

console.log("\n=== 3. Meme requete ATRAVES le proxy Vercel (meme chaine que le navigateur) ===\n");
await probe("GET /api/admin/stats via vocoshop.app", `${SITE}/api/admin/stats`, { Authorization: `Bearer ${adminToken}` });

console.log("\n=== 4. Le login backend repond-il ? (POST, mot de passe bidon) ===\n");
await probe("POST /api/admin/auth/login (email bidon)", `${SITE}/api/admin/auth/login`, {
  "Content-Type": "application/json",
}, "manual").then(async () => {
  const t0 = Date.now();
  const r = await fetch(`${SITE}/api/admin/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: "verification-bidon@example.invalid", password: "x" }),
    redirect: "manual",
  });
  results.push(["POST login (401 attendu)", r.status, Date.now() - t0, ""]);
});

console.log("  verdict".padEnd(46) + " HTTP   temps");
for (const [l, s, ms, loc] of results) {
  const tag = s === 200 || s === 401 ? "ok " : ">>> ";
  console.log("  " + tag + l.padEnd(40) + " " + s + "   " + ms + "ms" + (loc ? "  -> " + loc : ""));
}