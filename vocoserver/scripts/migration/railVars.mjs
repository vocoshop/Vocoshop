import fs from "fs";

/* Extraction souple : le separateur visuel du tableau n'est pas stable
   selon l'encodage, donc on se base uniquement sur le nom de la cle
   et sur la premiere suite de caracteres non blancs apres le padding. */
const raw = fs.readFileSync("C:/Users/PC/AppData/Local/Temp/opencode/railway_vars.txt", "utf8");

export function railVar(name) {
  for (const line of raw.split(/\r?\n/)) {
    /* La valeur est limitee a l'ASCII imprimable : les caracteres de
       bordure du tableau (U+2502 etc.) ne peuvent donc pas y entrer. */
    const m = line.match(/([A-Z][A-Z0-9_]{1,})\s+([\x20-\x7E]+?)\s*$/);
    if (m && m[1] === name) return m[2];
  }
  return null;
}

if (process.argv[2] === "--probe") {
  for (const k of ["ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_NAME", "MONGO_URI"]) {
    const v = railVar(k);
    console.log(`${k.padEnd(15)} ${v === null ? "ABSENTE" : "trouvee (" + v.length + " car.)"}`);
  }
}