import fs from "fs";

const auth = JSON.parse(fs.readFileSync("C:/Users/PC/AppData/Roaming/com.vercel.cli/Data/auth.json", "utf8"));

const r = await fetch("https://api.vercel.com/v9/projects?limit=50", {
  headers: { Authorization: "Bearer " + auth.token },
});
const data = await r.json();
console.log("=== projets Vercel du compte/team ===");
for (const p of data.projects ?? []) {
  const link = p.link ? p.link.org + "/" + p.link.repo + " (" + p.link.productionBranch + ")" : "pas de git";
  const root = (p.rootDirectories ?? []).join(",") || "(racine)";
  console.log(`  ${p.name.padEnd(22)} id=${p.id}  root=${root}  git=${link}`);
}

/* Les deployments qui pointent encore vers chacun */
for (const name of ["vocoshop-web", "voco-web", "vocoshop-vocoserver"]) {
  const proj = (data.projects ?? []).find((p) => p.name === name);
  if (!proj) { console.log(`\n${name}: ABSENT`); continue; }
  const rd = await fetch(`https://api.vercel.com/v6/deployments?projectId=${proj.id}&limit=3&target=production`, {
    headers: { Authorization: "Bearer " + auth.token },
  });
  const dd = await rd.json();
  console.log(`\n${name} (derniers deploiements prod) :`);
  for (const d of dd.deployments ?? []) {
    const meta = d.meta ?? {};
    console.log(`  ${new Date(d.createdAt).toISOString().slice(0, 16)}  ${(d.url ?? "").slice(0, 50)}  commit=${(meta.githubCommitSha ?? "").slice(0, 7) || "n/a"}`);
  }
}