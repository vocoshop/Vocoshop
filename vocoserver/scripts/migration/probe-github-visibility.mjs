import fs from "fs";

const token = process.env.GITHUB_TOKEN ?? null;
const auth = JSON.parse(fs.readFileSync("C:/Users/PC/AppData/Roaming/com.vercel.cli/Data/auth.json", "utf8"));

/* Visibilite du repo via l'API GitHub (token GitHub si dispo, sinon
   via le token Vercel qui ne sert pas ici : on tente l'API publique). */
async function gh(url, hdr) {
  const r = await fetch(url, { headers: hdr ?? { "User-Agent": "probe" } });
  return { s: r.status, d: r.json ? await r.json() : null };
}

let res = await gh("https://api.github.com/repos/vocoshop/Vocoshop");
if (res.s !== 200) {
  console.log("API publique -> " + res.s + " (repo prive ou rate-limite)");
} else {
  console.log("repo public  : " + res.d.private === false ? "OUI" : res.d.private);
  console.log("visibility   : " + res.d.visibility);
  console.log("archived     : " + res.d.archived);
  console.log("default branch: " + res.d.default_branch);
}