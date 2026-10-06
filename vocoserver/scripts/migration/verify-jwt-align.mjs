import fs from "fs";
import jwt from "jsonwebtoken";

/* Verifie l'alignement des JWT_SECRET sans toucher la base ni le
   mot de passe admin : on signe un jeton de TEST avec la valeur Railway,
   exactement comme le fait adminAuthController.ts, et on le presente
   comme cookie a /super-admin/dashboard.

   Si proxy.ts valide la signature, la reponse est 200.
   Si les secrets divergent encore, on recoit 307 vers /admin/login. */

const secret = fs.readFileSync("C:/Users/PC/AppData/Local/Temp/opencode/jwt_secret.txt", "utf8");

/* Meme payload que adminAuthController.ts:124 */
const token = jwt.sign(
  { role: "owner", email: "verification-interne@example.invalid", name: "Verification Interne" },
  secret,
  { expiresIn: "7d" },
);

console.log("jeton de test signe avec le JWT_SECRET de Railway (longueur " + token.length + ")");

for (const path of ["/super-admin/dashboard", "/super-admin", "/admin/dashboard"]) {
  const res = await fetch("https://www.vocoshop.app" + path, {
    redirect: "manual",
    headers: { Cookie: `adminToken=${token}` },
  });
  const loc = res.headers.get("location") || "(aucun)";
  const verdict = res.status === 200 ? "PASSE - signature acceptee" : "REFUSE - signature rejetee";
  console.log(`  ${path.padEnd(24)} HTTP ${res.status}  ${verdict}`);
  if (loc !== "(aucun)") console.log(`      redirect -> ${loc}`);
}

/* Temoin : un jeton signe avec un secret bidon doit etre refuse.
   S'il passe, la verification de signature est inactive. */
const bogus = jwt.sign({ role: "owner", email: "x@example.invalid" }, "secret-bidon-non-configure-000", {
  expiresIn: "7d",
});
const r2 = await fetch("https://www.vocoshop.app/super-admin/dashboard", {
  redirect: "manual",
  headers: { Cookie: `adminToken=${bogus}` },
});
console.log(`\n  temoin (secret bidon)  HTTP ${r2.status}  ` + (r2.status === 200 ? "ANOMALIE - signature non verifiee" : "correctement refuse"));