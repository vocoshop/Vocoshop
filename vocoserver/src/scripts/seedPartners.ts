import mongoose from "mongoose";
import dotenv from "dotenv";
import Partner from "../models/Partner";

dotenv.config();

const PARTENAIRES_INIT = [
  {
    name: "Microfinance Soleil",
    type: "Microfinance",
    email: "contact@microfinancesoleil.cg",
    phone: "+24206XXXXXXXX",
    min: 100000,
    max: 5000000,
    responseTime: "72 heures",
    rate: "3.5%/mois",
    active: true,
    order: 1,
  },
  {
    name: "Banque Populaire Congo",
    type: "Banque",
    email: "credits@bpc.cg",
    phone: "+24205XXXXXXXX",
    min: 500000,
    max: 20000000,
    responseTime: "5 jours",
    rate: "2.8%/mois",
    active: true,
    order: 2,
  },
  {
    name: "Financement Express",
    type: "Microfinance",
    email: "demandes@financementexpress.cg",
    phone: "+24204XXXXXXXX",
    min: 50000,
    max: 3000000,
    responseTime: "48 heures",
    rate: "4%/mois",
    active: true,
    order: 3,
  },
  {
    name: "TrustMicro CG",
    type: "Microfinance",
    email: "info@trustmicro.cg",
    phone: "+24206XXXXXXXX",
    min: 200000,
    max: 8000000,
    responseTime: "96 heures",
    rate: "3%/mois",
    active: true,
    order: 4,
  },
];

async function seed() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error("❌ MONGO_URI manquant dans .env");
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log("✅ Connecté à MongoDB");

  for (const p of PARTENAIRES_INIT) {
    const exists = await Partner.findOne({ name: p.name });
    if (!exists) {
      await Partner.create(p);
      console.log(`  ✅ Créé : ${p.name}`);
    } else {
      console.log(`  ⏭️  Existe déjà : ${p.name}`);
    }
  }

  const total = await Partner.countDocuments();
  console.log(`\n📊 Total partenaires en DB : ${total}`);

  await mongoose.disconnect();
  console.log("👋 Déconnecté");
}

seed().catch((err) => {
  console.error("❌ Erreur seed:", err);
  process.exit(1);
});
