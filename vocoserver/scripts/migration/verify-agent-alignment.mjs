import fs from "fs";
import crypto from "crypto";

/* Relit AGENT_JWT_SECRET depuis l'API Vercel decryptee (empreinte seul) et
   compare a Railway. Aucune valeur n'est affichee. */
const auth = JSON.parse(fs.readFileSync("C:/Users/PC/AppData/Roaming/com.vercel.cli/Data/auth.json", "utf8"));
const token = auth.token;
const PROJECT = "prj_V98tjUgvhRIEFGNkSSKEhiYu6TsI";

const sha = (s) => crypto.createHash("sha256").update(s, "utf8").digest("hex").slice(0, 12);

async function getDecrypted() {
  /* L'API v8 sans decrypte ne renvoie pas la valeur des secrets.
     Tentative: endpoint d'edition /env/:id ou parametre decrypt=true. */
  const res = await fetch(
    `https://api.vercel.com/v9/projects/${PROJECT}/env?decrypt=true`,
    { headers: { Authorization: "Bearer " + token } },
  );
  const data = await res.json();
  for (const e of data.envs ?? []) {
    if (e.key !== "AGENT_JWT_SECRET") continue;
    const raw = Array.isArray(e.value) ? e.value.map((v) => v.value ?? "").join("") : (e.value ?? "");
    return { target: e.target, raw, id: e.id, type: e.type };
  }
  return null;
}

const railOut = (await import("child_process")).execFileSync("railway", ["variables", "--kv"], {
  cwd: "C:/Users/PC/Desktop/MON PROJET/vocoserver",
  encoding: "utf8",
  shell: true,
}).split(/\r?\n/).reduce((acc, line) => {
  const i = line.indexOf("=");
  if (i > 0) acc[line.slice(0, i).trim()] = line.slice(i + 1);
  return acc;
}, {});

const vercel = await getDecrypted();
const rail = railOut.AGENT_JWT_SECRET ?? "";
console.log("=== etat AGENT_JWT_SECRET ===");
console.log("  Railway  : " + (rail ? rail.length + " car., empreinte " + sha(rail) : "ABSENTE"));
if (vercel) {
  console.log("  Vercel   : " + (vercel.raw ? vercel.raw.length + " car., empreinte " + sha(vercel.raw) : "VALEUR VIDE/MASQUEE via API"));
  console.log("  cibles   : " + JSON.stringify(vercel.target));
  console.log("  type     : " + vercel.type);
  console.log("  id       : " + vercel.id);
  console.log("  ALIGNES  : " + (!!rail && !!vercel.raw && rail === vercel.raw));
} else {
  console.log("  Vercel   : ABSENTE");
}