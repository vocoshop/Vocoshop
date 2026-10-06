/* Reforme la source minifiee pour re-identifier le setter de state.
   Le pattern `c(!0)` / `c(!1)` correspond a setLoading(true/false)
   apres minification : on verifie l'ORDRE, pas le nom du setter. */
const html = await (await fetch("https://www.vocoshop.app/admin/login")).text();
const chunks = [...new Set([...html.matchAll(/\/_next\/static\/chunks\/[a-zA-Z0-9_\-]+\.js/g)].map((m) => m[0]))];
let combined = "";
for (const c of chunks) combined += (await (await fetch("https://www.vocoshop.app" + c)).text()) + "\n";

const loginAt = combined.indexOf("admin/auth/login");
const pushAt = combined.indexOf('push("/super-admin/dashboard")', loginAt);
console.log("=== parcours deploye, du fetch au push ===\n");
console.log(combined.slice(loginAt - 40, pushAt + 40).replace(/\s+/g, " ") + "\n");

const between = combined.slice(loginAt, pushAt);

/* Sur le chemin du succes (apres le test !t.ok), on doit trouver
   une remise a false du loading AVANT le push. */
const afterOk = between.slice(between.indexOf("return"));
const setTrue = afterOk.match(/\w+\(!0\)/g) || [];
const setFalse = afterOk.match(/\w+\(!1\)/g) || [];

console.log("apres le test !res.ok :");
console.log("  remises a true  (loading=true)  : " + (setTrue.length ? setTrue.join(", ") : "aucune"));
console.log("  remises a false (loading=false) : " + (setFalse.length ? setFalse.join(", ") : "aucune"));

/* Le dernier setLoading(true) precede le dernier setLoading(false) ? */
const lastTrue = afterOk.lastIndexOf(setTrue[setTrue.length - 1]);
const lastFalse = afterOk.lastIndexOf(setFalse[setFalse.length - 1]);
const ordered = setFalse.length > 0 && lastFalse > lastTrue;
console.log("\n  setLoading(false) apres setLoading(true) : " + (ordered ? "OUI - le bouton se libere" : "NON - bouton potentiellement fige"));
console.log("  garde-fou apres le push : " + (combined.includes("dashboard est injoignable") || combined.includes("Connexion r") ? "OUI" : "NON"));