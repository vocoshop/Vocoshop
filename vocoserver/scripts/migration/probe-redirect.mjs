/* redirect: "manual" pour voir le VRAI status et l'en-tete Location,
   au lieu de suivre la redirection et de lire la page de destination. */
for (const path of ["/admin/login", "/super-admin/dashboard", "/super-admin", "/admin/dashboard"]) {
  const res = await fetch("https://www.vocoshop.app" + path, { redirect: "manual" });
  const loc = res.headers.get("location") || "(aucun)";
  const body = await res.text();
  const isLoginForm = body.includes("Se connecter");
  const is404 = body.includes("_not-found") || body.includes("Page introuvable");
  console.log(
    `${path.padEnd(26)} ${res.status}  location=${loc.padEnd(24)} ${String(body.length).padStart(6)} oct  ` +
      `${is404 ? "404" : ""}${isLoginForm ? "login-form" : ""}`,
  );
}