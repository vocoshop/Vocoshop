import fs from "fs";

const base = "https://www.vocoshop.app";
const chunks = [
  "/_next/static/chunks/0o2n1tkzt3viw.js",
  "/_next/static/chunks/0_md4akuh-2hg.js",
  "/_next/static/chunks/0e5o02y2qa7sp.js",
  "/_next/static/chunks/0st5kx_wldhh4.js",
];

let combined = "";
for (const c of chunks) {
  const js = await (await fetch(base + c)).text();
  combined += js + "\n";
}

console.log("=== contexte autour de 'admin/auth/login' ===\n");
let i = combined.indexOf("admin/auth/login");
while (i !== -1) {
  console.log("  ..." + combined.slice(Math.max(0, i - 300), i + 160).replace(/\s+/g, " ") + "...");
  console.log("");
  i = combined.indexOf("admin/auth/login", i + 1);
}

/* Cherche comment l'API est resolue : variable compilee, ou fallback. */
console.log("=== comment API_URL est resolu ===\n");
for (const m of combined.matchAll(/NEXT_PUBLIC_API_URL/g)) {
  console.log("  occurrence a " + m.index + " :");
  console.log("    ..." + combined.slice(Math.max(0, m.index - 120), m.index + 120).replace(/\s+/g, " ") + "\n");
}

const vars = combined.match(/"[A-Za-z0-9_]{6,30}":"\/api"/g);
console.log("=== constantes /api compilees ===");
console.log(vars && vars.length ? "  " + [...new Set(vars)].join("\n  ") : "  aucune");

fs.writeFileSync("C:/Users/PC/AppData/Local/Temp/opencode/chunks.txt", combined);
console.log("\n  (chunks sauvegardes pour inspection)")