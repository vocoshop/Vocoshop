import { execFileSync } from "child_process";

/* Recupere le credential GitHub via le credential helper git SANS jamais
   afficher le token : il est consomme en memoire pour les appels API. */
const BASE = "https://api.github.com/repos/vocoshop/Vocoshop";

let token = null;
try {
  const out = execFileSync("git", ["credential-fill"], {
    input: "protocol=https\nhost=github.com\n\n",
    encoding: "utf8",
    shell: false,
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 1024 * 1024,
  });
  const m = out.match(/^password=(.*)$/m);
  token = m ? m[1].trim() : null;
} catch (e) {
  console.log("credential-fill a echoue : " + String(e.message).slice(0, 80));
}
console.log("token recupere : " + (token ? "OUI (longueur " + token.length + ", non affiche)" : "NON"));
if (!token) process.exit(1);

const hdr = {
  "User-Agent": "security-audit",
  Accept: "application/vnd.github+json",
  Authorization: "Bearer " + token,
};

async function probe(label, url) {
  const r = await fetch(url, { headers: hdr });
  const body = await r.json().catch(() => null);
  console.log("\n" + label + "  ->  HTTP " + r.status);
  if (r.status !== 200) {
    console.log("   message : " + (body?.message ?? "(pas de corps)").slice(0, 120));
    return null;
  }
  return body;
}

const alerts = await probe("secret-scanning/alerts (ouvertes)", BASE + "/secret-scanning/alerts?state=open&per_page=100");
if (alerts) {
  console.log("   nombre : " + (Array.isArray(alerts) ? alerts.length : "?"));
  for (const a of (Array.isArray(alerts) ? alerts : []).slice(0, 30)) {
    console.log("     - " + (a.secret_type_display_name ?? a.secret_type) + "   " + (a.disposition ?? "?") + "   repo=" + (a.repository?.full_name ?? "?"));
  }
}

const closed = await probe("secret-scanning/alerts (toutes)", BASE + "/secret-scanning/alerts?per_page=100");
if (closed) {
  const byState = {};
  for (const a of closed) byState[a.state] = (byState[a.state] ?? 0) + 1;
  console.log("   par etat : " + JSON.stringify(byState));
  for (const a of closed.slice(0, 20)) {
    console.log("     - [" + a.state + "] " + (a.secret_type_display_name ?? a.secret_type) + "  " + (a.disposition ?? "?"));
  }
}

const dep = await probe("dependabot/alerts (ouverts)", BASE + "/dependabot/alerts?state=open&per_page=100");
if (dep) console.log("   nombre : " + (Array.isArray(dep) ? dep.length : "?"));

/* Autorisations du token : peut-il ecrire ? (pour savoir si on peut corriger) */
const me = await probe("rate_limit (auth OK?)", "https://api.github.com/rate_limit");
if (me) console.log("   reste : " + me.resources.core.remaining + "/" + me.resources.core.limit);