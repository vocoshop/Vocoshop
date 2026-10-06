const base = "https://www.vocoshop.app";

/* Les chunks de la page admin/login : on cherche l'URL d'API reellement
   compilee dans le build Vercel. */
const chunks = [
  "/_next/static/chunks/0o2n1tkzt3viw.js",
  "/_next/static/chunks/0_md4akuh-2hg.js",
  "/_next/static/chunks/0jp5gkf6-we-z.js",
];

for (const c of chunks) {
  const res = await fetch(base + c);
  const js = await res.text();
  console.log(`\n=== ${c}  (${js.length} octets) ===`);

  const hits = new Set();
  for (const m of js.matchAll(/(https?:\/\/[a-zA-Z0-9._\-]*railway\.app[a-zA-Z0-9._\-]*)/g)) hits.add(m[1]);
  for (const m of js.matchAll(/(\/api\/admin[a-zA-Z0-9._\-\/]*)/g)) hits.add(m[1]);
  for (const m of js.matchAll(/(admin\/auth\/login)/g)) hits.add(m[1]);

  console.log(hits.size ? "  " + [...hits].join("\n  ") : "  aucune reference admin/API");

  /* Si l'API est injectee via une variable d'env Next, elle apparait
     sous forme de constante chiffree dans le chunk. */
  const envish = js.match(/"NEXT_PUBLIC_[A-Z_]+":\s*"[^"]*"/g);
  if (envish) console.log("  env: " + envish.join(" | "));
}