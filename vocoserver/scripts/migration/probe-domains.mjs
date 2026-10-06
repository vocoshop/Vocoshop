import fs from "fs";

const auth = JSON.parse(fs.readFileSync("C:/Users/PC/AppData/Roaming/com.vercel.cli/Data/auth.json", "utf8"));
const H = { Authorization: "Bearer " + auth.token };

const projects = {
  "vocoshop-vocoserver": "prj_V98tjUgvhRIEFGNkSSKEhiYu6TsI",
  "voco-web": "prj_TTYSZUdWDY5jr3LiJxzvrsKH6bUX",
  "vocoshop-web": "prj_R2ucNqyffToV7bgeRdHPgfmPzUJw",
};

for (const [name, id] of Object.entries(projects)) {
  const r = await fetch(`https://api.vercel.com/v4/projects/${id}/domains?limit=100`, { headers: H });
  const d = await r.json();
  console.log("\n" + name + "  (" + (d.domains ?? []).length + " domaine(s)) :");
  for (const dom of d.domains ?? []) {
    const p = typeof dom.projectId === "string" ? dom.projectId : (dom.projects?.[0] ?? "(libre)");
    console.log("    " + String(dom.name).padEnd(40) + " -> projet " + p.slice(0, 26));
  }
}