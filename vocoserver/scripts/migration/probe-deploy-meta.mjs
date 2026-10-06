import fs from "fs";

/* Extrait uniquement les metadonnees d'identite du deploiement :
   commit, source git, alias. Ignore le tableau enorme des builds. */
const raw = fs.readFileSync("C:/Users/PC/AppData/Local/Temp/opencode/dep.json", "utf8");
const start = raw.indexOf("{");
let o = null;
for (let i = start; i < raw.length; i++) {
  try {
    o = JSON.parse(raw.slice(i));
    break;
  } catch {}
}
if (!o) {
  console.log("JSON illisible");
  process.exit(1);
}

const m = o.meta ?? {};
const g = o.gitSource ?? {};

console.log("=== deploiement en production ===");
console.log("  id              " + o.id);
console.log("  url             " + o.url);
console.log("  target          " + o.target);
console.log("  ready           " + o.readyState);
console.log("  cree le         " + o.created);

console.log("\n=== source Git du deploiement ===");
console.log("  gitSource.type  " + (g.type ?? "(aucune : deploiement CLI)"));
console.log("  gitSource.owner " + (g.owner ?? "-"));
console.log("  gitSource.repo  " + (g.repo ?? "-"));
console.log("  commitSha       " + (m.githubCommitSha ?? m.commitSha ?? "(aucun)"));
console.log("  commitRef       " + (m.githubCommitRef ?? m.commitRef ?? "(aucun)"));
console.log("  commitBranch    " + (m.githubCommitBranch ?? "-"));
console.log("  commitMessage   " + (m.githubCommitMessage ?? m.commitMessage ?? "(aucun)"));
console.log("  commitAuthor    " + (m.githubCommitAuthorLogin ?? m.commitAuthor ?? "-"));

console.log("\n=== alias (domaines servis par CE deploiement) ===");
for (const a of o.aliases ?? []) console.log("  " + a);