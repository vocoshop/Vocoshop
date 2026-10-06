import fs from "fs";
import { execFileSync } from "child_process";
import crypto from "crypto";

/* Empreintes SHA-256 (12 premiers caracteres) des AGENT_JWT_SECRET
   cote Railway et cote Vercel (production). Jamais de valeur affichee. */
const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);

const auth = JSON.parse(fs.readFileSync("C:/Users/PC/AppData/Roaming/com.vercel.cli/Data/auth.json", "utf8"));
const token = auth.token;
if (!token) { console.log("pas de token Vercel"); process.exit(1); }

const rail = {};
const out = execFileSync("railway", ["variables", "--kv"], {
  cwd: "C:/Users/PC/Desktop/MON PROJET/vocoserver",
  encoding: "utf8",
  shell: true,
});
for (const line of out.split(/\r?\n/)) {
  const i = line.indexOf("=");
  if (i > 0) rail[line.slice(0, i).trim()] = line.slice(i + 1);
}

const res = await fetch("https://api.vercel.com/v8/projects/prj_V98tjUgvhRIEFGNkSSKEhiYu6TsI/env", {
  headers: { Authorization: "Bearer " + token },
});
const envs = await res.json();

let vercelProd = null;
let vercelPrev = null;
for (const e of envs.envs ?? []) {
  if (e.key !== "AGENT_JWT_SECRET") continue;
  const v = Array.isArray(e.value) ? e.value[0].value : e.value;
  if (e.target?.includes("production")) vercelProd = v;
  if (e.target?.includes("preview")) vercelPrev = v;
}

console.log("AGENT_JWT_SECRET");
console.log("  Railway        " + sha(rail.AGENT_JWT_SECRET ?? ""));
console.log("  Vercel prod    " + (vercelProd ? sha(vercelProd) : "(absente)"));
console.log("  Vercel prev    " + (vercelPrev ? sha(vercelPrev) : "(absente)"));
console.log("  Railway==Vercel prod : " + (rail.AGENT_JWT_SECRET && vercelProd ? rail.AGENT_JWT_SECRET === vercelProd : false));