const url = process.argv[2];
const res = await fetch(url, { redirect: "follow" });
const html = await res.text();

console.log("=== " + url + " ===");
console.log("  HTTP " + res.status + "   " + html.length + " octets\n");

const markers = [
  "_not-found",
  "Page introuvable",
  "ClientPageRoot",
  "super-admin/dashboard",
  "adminToken",
  "admin/auth/login",
  "Se connecter",
  "Connexion...",
  "placeholder",
  "NEXT_PUBLIC",
];
console.log("=== marqueurs ===");
for (const m of markers) console.log(`  ${html.includes(m) ? "OUI" : "non"}  ${m}`);

/* Les chunks JS reveals l'URL d'API reellement utilisee par le build. */
const chunks = [...html.matchAll(/\/_next\/static\/chunks\/[a-zA-Z0-9_\-]+\.js/g)].map((m) => m[0]);
const uniq = [...new Set(chunks)];
console.log(`\n=== chunks JS (${uniq.length}) ===`);
for (const c of uniq) console.log("  " + c);

/* Cherche l'URL Railway dans le HTML lui-meme. */
const rail = html.match(/https:\/\/[a-z0-9.\-]*railway\.app[^\s"'\\]*/gi);
console.log("\n=== URLs Railway dans le HTML ===");
console.log(rail && rail.length ? [...new Set(rail)].join("\n") : "  aucune");

/* Les URLs d'API sont souvent dans les chunks, pas dans le HTML :
   on les signale pour une inspection ciblee. */
const apiRefs = html.match(/\/api\/[a-zA-Z0-9_\-\/]+/g);
console.log("\n=== references /api dans le HTML ===");
console.log(apiRefs ? [...new Set(apiRefs)].slice(0, 12).join("\n") : "  aucune");