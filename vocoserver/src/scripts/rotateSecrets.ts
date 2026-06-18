// scripts/rotateSecrets.ts
// ⚠️ À EXÉCUTER APRÈS avoir changé les env vars sur Render
// npm run ts-node src/scripts/rotateSecrets.ts
import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import dotenv from "dotenv";
dotenv.config();

async function rotate() {
  const uri = process.env.MONGO_URI;
  if (!uri) { console.error("❌ MONGO_URI manquant"); process.exit(1); }

  await mongoose.connect(uri);
  console.log("✅ MongoDB connecté");

  // 1. Mettre à jour le mot de passe admin dans la DB
  const PC = mongoose.model("PlatformConfig", new mongoose.Schema({}, { strict: false, collection: "platformconfigs" }));

  const newPwd = process.env.ADMIN_PASSWORD;
  const email = process.env.ADMIN_EMAIL;
  if (newPwd && email) {
    const hash = await bcrypt.hash(newPwd, 10);
    await PC.updateOne(
      { key: "admin_auth" },
      { $set: { value: { email, passwordHash: hash }, updatedAt: new Date().toISOString() } },
      { upsert: true }
    );

    const verify = await bcrypt.compare(newPwd, hash);
    const adminUpdated = verify;
    console.log("🔑 Admin password mis à jour :", adminUpdated);
  }

  // 2. JWT secrets vérifiés (booléens seulement)
  const hasJwtSecret = !!process.env.JWT_SECRET;
  const hasAgentJwtSecret = !!process.env.AGENT_JWT_SECRET;
  console.log("🔐 JWT_SECRET configuré :", hasJwtSecret);
  console.log("🔐 AGENT_JWT_SECRET configuré :", hasAgentJwtSecret);

  // 3. Vérifier OpenAI (booléen seulement)
  const hasOpenAiKey = !!process.env.OPENAI_API_KEY;
  console.log("🤖 OPENAI_API_KEY configuré :", hasOpenAiKey);

  // 4. Vérifier MongoDB password (booléen seulement)
  const mongoPwdPresent = !!uri.match(/\/\/([^:]+):([^@]+)@/)?.[2];
  console.log("🗄️ MongoDB password configuré :", mongoPwdPresent);

  await mongoose.disconnect();
  console.log("\n✅ Rotation terminée. Déploie les nouveaux secrets sur Render.");
}

rotate().catch(e => { console.error("❌", e.message); process.exit(1); });
