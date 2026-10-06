import { execFileSync } from "child_process";
import fs from "fs";

/* Sortie JSON de `vercel project inspect --json`, precedee de lignes
   de log : on isole le premier objet JSON bien forme. */
let raw = "";
try {
  raw = execFileSync("vercel", ["project", "inspect", "vocoshop-vocoserver", "--json"], {
    cwd: "C:/Users/PC/Desktop/MON PROJET/voco-web",
    encoding: "utf8",
    shell: true,
    maxBuffer: 20 * 1024 * 1024,
  });
} catch (e) {
  raw = (e.stdout ?? "") + (e.stderr ?? "");
}

const start = raw.indexOf("{");
let obj = null;
for (let i = start; i < raw.length; i++) {
  try {
    obj = JSON.parse(raw.slice(i));
    break;
  } catch {}
}

if (!obj) {
  console.log("Impossible de lire le JSON du projet. Extrait brut :");
  console.log(raw.slice(0, 600));
  process.exit(1);
}

console.log("=== projet Vercel ===");
for (const k of ["id", "name", "framework", "rootDirectory", "nodeVersion", "updatedAt"]) {
  console.log(`  ${k.padEnd(14)} ${obj[k]}`);
}

console.log("\n=== connexion Git ===");
const link = obj.link ?? null;
if (!link) {
  console.log("  AUCUNE connexion Git : ce projet n'est PAS lie a un depot GitHub.");
  console.log("  Les deploiements se font donc par le CLI (vercel --prod),");
  console.log("  a partir de l'etat local du disque.");
} else {
  console.log("  type          " + link.type);
  console.log("  org           " + link.org);
  console.log("  repo          " + link.repo);
  console.log("  branche       " + (link.productionBranch ?? "(aucune)"));
  console.log("  repo complet  " + (link.repoUrl ?? link.githubUrl ?? "(n/a)"));
}

fs.writeFileSync("C:/Users/PC/AppData/Local/Temp/opencode/vercel-project.json", JSON.stringify(obj, null, 2));