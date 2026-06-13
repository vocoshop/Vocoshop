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
    console.log(`🔑 Admin password (${email}): ${verify ? "✅ ROTATED" : "❌ FAIL"}`);
  }

  // 2. Vérifier les JWT secrets
  const jwt = process.env.JWT_SECRET;
  const agentJwt = process.env.AGENT_JWT_SECRET;
  if (jwt) console.log(`🔐 JWT_SECRET: ${jwt.substring(0, 12)}...${jwt.slice(-4)} (${jwt.length} chars)`);
  if (agentJwt) console.log(`🔐 AGENT_JWT_SECRET: ${agentJwt.substring(0, 12)}...${agentJwt.slice(-4)} (${agentJwt.length} chars)`);

  // 3. Vérifier OpenAI
  const openai = process.env.OPENAI_API_KEY;
  if (openai && !openai.includes("sk-proj-")) {
    console.log("🤖 OpenAI key: ✅ ROTATED");
  } else if (openai && openai.includes("sk-proj-")) {
    console.log("🤖 OpenAI key: ⚠️ ANCIENNE CLÉ — à rotater sur platform.openai.com");
  } else {
    console.log("🤖 OpenAI key: ⬜ à configurer");
  }

  // 4. Vérifier MongoDB password
  const mongoPwd = uri.match(/\/\/([^:]+):([^@]+)@/)?.[2];
  if (mongoPwd && (mongoPwd === "Vocoshop2026" || mongoPwd.includes("2026"))) {
    console.log(`🗄️ MongoDB password: ⚠️ ANCIEN — à changer sur Atlas`);
  } else if (mongoPwd) {
    console.log(`🗄️ MongoDB password: ✅ ROTATED`);
  }

  await mongoose.disconnect();
  console.log("\n✅ Rotation terminée. Déploie les nouveaux secrets sur Render.");
}

rotate().catch(e => { console.error("❌", e.message); process.exit(1); });
