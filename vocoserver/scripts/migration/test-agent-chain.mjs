import { execFileSync } from "child_process";
import jwt from "jsonwebtoken";

/* Teste aussi la chaine AGENT (proxy.ts utilise AGENT_JWT_SECRET pour
   /agent/*). Lecture seule, jeton synthetique de 10 min. */
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

const tok = jwt.sign({ role: "agent", id: "000000000000000000000000" }, rail.AGENT_JWT_SECRET, {
  expiresIn: "10m",
});

const SITE = "https://www.vocoshop.app";
console.log("=== chaine AGENT (meme type de verification) ===\n");
for (const p of ["/agent/dashboard", "/agent"]) {
  try {
    const r = await fetch(SITE + p, { redirect: "manual", headers: { Cookie: `agentToken=${tok}` } });
    const loc = r.headers.get("location") || "";
    const v = r.status === 200 ? "ACCEPTÉ" : r.status === 307 ? "REDIRIGÉ (secret probablement divergent)" : r.status;
    console.log("  " + p.padEnd(22) + " " + r.status + "   " + v);
    if (loc) console.log("      -> " + loc);
  } catch (e) {
    console.log("  " + p + "  erreur " + e.message);
  }
}