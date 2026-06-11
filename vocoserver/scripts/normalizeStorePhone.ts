import "dotenv/config";
import mongoose from "mongoose";
import Store from "../src/models/Store";

function normalizePhone(raw: any, defaultCountryCode = "242") {
const s = String(raw || "").trim();
if (!s) return "";

let p = s.replace(/[^\d+]/g, "");
if (p.startsWith("00")) p = "+" + p.slice(2);
if (p.startsWith("+")) return p;
if (p.startsWith("0")) return `+${defaultCountryCode}${p.slice(1)}`;
return `+${defaultCountryCode}${p}`;
}

async function main() {
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
if (!uri) throw new Error("MONGO_URI manquant");

await mongoose.connect(uri);
console.log("✅ Mongo connected");

const stores = await Store.find({}).select("_id phone").lean();
console.log("Stores:", stores.length);

const seen = new Map<string, string>();
let updated = 0;
let skipped = 0;

for (const s of stores) {
const oldPhone = String((s as any).phone || "");
const newPhone = normalizePhone(oldPhone);

if (!newPhone || newPhone === oldPhone) continue;

const prev = seen.get(newPhone);
if (prev && prev !== String((s as any)._id)) {
console.log("⚠️ COLLISION", { newPhone, a: prev, b: String((s as any)._id), oldPhone });
skipped++;
continue;
}
seen.set(newPhone, String((s as any)._id));

try {
await Store.updateOne({ _id: (s as any)._id }, { $set: { phone: newPhone } });
updated++;
} catch (e: any) {
console.log("⚠️ update failed", String((s as any)._id), e?.code, e?.message);
skipped++;
}
}

console.log("✅ Done", { updated, skipped });
await mongoose.disconnect();
}

main().catch((e) => {
console.error(e);
process.exit(1);
});
