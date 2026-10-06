import { execFileSync } from "child_process";

/* Extraction des variables Railway en direct (format --kv), sans fichier
   intermediaire : rien de sensible ne reste sur le disque. */
export function railVar(name) {
  const out = execFileSync("railway", ["variables", "--kv"], {
    cwd: "C:/Users/PC/Desktop/MON PROJET/vocoserver",
    encoding: "utf8",
    shell: true,
  });
  const i = out.indexOf(name + "=");
  if (i === -1) return null;
  const start = i + name.length + 1;
  const end = out.indexOf("\n", start);
  const line = out.slice(start, end === -1 ? undefined : end);
  return /[\x00-\x1F]/.test(line.trim()) ? line.trim() : line.trim();
}

if (process.argv[2] === "--probe") {
  for (const k of ["ADMIN_EMAIL", "ADMIN_PASSWORD", "ADMIN_NAME", "MONGO_URI"]) {
    const v = railVar(k);
    console.log(`${k.padEnd(15)} ${v === null ? "ABSENTE" : "trouvee (" + v.length + " car.)"}`);
  }
}