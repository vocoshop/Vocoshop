import fs from "fs";

/* Lit le token Vercel depuis auth.json et interroge l'API REST pour
   verifier le lien Git du projet. Le token n'est jamais affiche. */
const authPath = "C:/Users/PC/AppData/Roaming/com.vercel.cli/Data/auth.json";
const auth = JSON.parse(fs.readFileSync(authPath, "utf8"));
const token = auth.token ?? null;
if (!token) {
  console.log("pas de token dans auth.json");
  process.exit(1);
}

const res = await fetch("https://api.vercel.com/v9/projects/prj_V98tjUgvhRIEFGNkSSKEhiYu6TsI", {
  headers: { Authorization: "Bearer " + token },
});
const data = await res.json();

console.log("=== via REST API /v9/projects ===");
console.log("  name        " + data.name);
console.log("  rootDirs    " + JSON.stringify(data.rootDirectories ?? []));
const link = data.link ?? data.gitRepository ?? null;
if (!link) {
  console.log("  link        AUCUN (non lie a GitHub)");
} else {
  console.log("  link.type   " + link.type);
  console.log("  link.org    " + link.org);
  console.log("  link.repo   " + link.repo);
  console.log("  production  " + link.productionBranch);
  console.log("  repoId      " + link.repoId);
}