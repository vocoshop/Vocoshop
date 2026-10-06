import fs from "fs";

const raw = fs.readFileSync("C:/Users/PC/AppData/Local/Temp/opencode/proj2.json", "utf8");
const s = raw.indexOf("{");
let o = null;
for (let i = s; i < raw.length; i++) {
  try {
    o = JSON.parse(raw.slice(i));
    break;
  } catch {}
}

if (!o) {
  console.log("JSON illisible");
  process.exit(1);
}

const link = o.link ?? o.gitRepository ?? null;
console.log("=== lien Git du projet ===");
if (!link) {
  console.log("  AUCUN lien dans inspect --json");
} else {
  console.log(JSON.stringify(link, null, 2));
}
console.log("=== autres cles utiles ===");
console.log("  connectConfiguration : " + JSON.stringify(o.connectConfiguration ?? "(absent)"));
console.log("  linkedProjects... les cles sont :");
console.log("  " + Object.keys(o).join(", "));