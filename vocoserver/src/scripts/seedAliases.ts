import mongoose from "mongoose";
import dotenv from "dotenv";
import Product from "../models/Product";

dotenv.config();

const DEFAULT_ALIASES: Record<string, string[]> = {
  "primus": ["primus", "premisse", "primuss", "primus gm", "bière primus"],
  "coca-cola": ["coca", "coca cola", "koka", "coke", "coca un litre", "cola"],
  "fanta": ["fanta", "fanta orange", "fanta citron"],
  "beaufort": ["beaufort", "bofor", "beufort", "bière beaufort"],
  "turbo king": ["turbo", "turbo king", "turboking"],
  "skol": ["skol", "skolle", "bière skol"],
  "maltina": ["maltina", "maltinna", "malt"],
  "vitalo": ["vitalo", "vital", "vitao"],
  "savon": ["savon", "savonnette", "savon mami wata", "savon de toilette"],
  "mami wata": ["mami wata", "mamy wata", "mamiwata", "savon mami"],
  "riz": ["riz", "riz parfumé", "riz thailande", "riz 5kg", "riz 1kg"],
  "huile": ["huile", "huile végétale", "huile de palme", "d'huile", "l'huile"],
  "sucre": ["sucre", "sucre en poudre", "sucre en morceaux", "sukali"],
  "farine": ["farine", "farine de blé", "farine de maïs"],
  "lait": ["lait", "lait concentré", "lait en poudre", "lait granulé", "lait caillé"],
  "beurre": ["beurre", "beurre de cacahuète", "beurre de karité"],
  "pâte": ["pâte", "pâte d'arachide", "pâte de tomate", "pâte alimentaire"],
  "yaourt": ["yaourt", "yogourt", "yaour"],
  "fromage": ["fromage", "frommage"],
  "pain": ["pain", "pain de mie", "baguette"],
  "biscuit": ["biscuit", "biscotte", "gâteau", "gateau", "cookie"],
  "chocolat": ["chocolat", "chocolat en poudre", "chocolat noir", "chocolat au lait"],
  "bonbon": ["bonbon", "bonbon sucré", "sucette", "caramel"],
  "jus": ["jus", "jus de fruit", "jus d'orange", "jus de bissap"],
  "eau": ["eau", "eau minérale", "eau plate", "eau gazeuse", "de l'eau"],
  "boisson": ["boisson", "boisson gazeuse", "soda", "boisson sucrée"],
  "poulet": ["poulet", "poulet braisé", "poulet frit", "pilet"],
  "poisson": ["poisson", "poisson salé", "poisson fumé", "poisson frais", "tirera"],
  "mouton": ["mouton", "viande de mouton", "moton"],
  "tomate": ["tomate", "tomates", "tomate fraîche", "concentré de tomate"],
  "oignon": ["oignon", "ognon", "oignons", "oignon frais"],
  "mayonnaise": ["mayonnaise", "mayo", "maionese"],
  "ketchup": ["ketchup", "ketcup", "ketchup doux", "sauce tomate"],
  "bouillon": ["bouillon", "bouillon cube", "cube maggi", "jumbo", "assaisonnement"],
  "cube": ["cube", "cube maggi", "bouillon", "jumbo"],
  "sel": ["sel", "sel de cuisine", "sel fin", "sel gemme"],
  "poivre": ["poivre", "pouivre", "poivre noir"],
  "pile": ["pile", "piles", "batterie", "batterie aa", "pile aa"],
  "ampoule": ["ampoule", "ampoule led", "lumière", "lampe"],
  "bougie": ["bougie", "chandelle"],
  "allumette": ["allumette", "allumettes", "briguet", "briquet"],
};

async function seedAliases() {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) {
      console.error("❌ MONGO_URI non défini dans .env");
      process.exit(1);
    }
    await mongoose.connect(uri);
    console.log("📦 Connecté MongoDB");

    const products = await Product.find({}).lean();
    let updated = 0;

    for (const product of products) {
      const normalized = (product as any).name.toLowerCase().trim();
      let foundAliases: string[] = [];

      for (const [key, aliases] of Object.entries(DEFAULT_ALIASES)) {
        if (normalized.includes(key)) {
          foundAliases = [...foundAliases, ...aliases];
        }
      }

      if (foundAliases.length > 0) {
        const unique = [...new Set(foundAliases)];
        const existing = (product as any).aliases || [];
        const merged = [...new Set([...existing, ...unique])];

        await Product.updateOne(
          { _id: product._id },
          { $set: { aliases: merged } }
        );
        updated++;
        console.log(`✅ ${(product as any).name} → ${merged.join(", ")}`);
      }
    }

    console.log(`\n🎉 ${updated} produits mis à jour avec des alias`);
    process.exit(0);
  } catch (err) {
    console.error("❌ Erreur seedAliases:", err);
    process.exit(1);
  }
}

seedAliases();
