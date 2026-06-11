import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import dotenv from 'dotenv';

dotenv.config();

async function fix() {
  await mongoose.connect(process.env.MONGO_URI);
  const PC = mongoose.model('PlatformConfig', new mongoose.Schema({}, { strict: false, collection: 'platformconfigs' }));
  const newHash = await bcrypt.hash(process.env.ADMIN_PASSWORD, 10);
  await PC.updateOne(
    { key: 'admin_auth' },
    { $set: { value: { email: process.env.ADMIN_EMAIL, passwordHash: newHash } } },
    { upsert: true }
  );
  console.log('DB admin credentials mis à jour !');
  console.log('Email:', process.env.ADMIN_EMAIL);

  const doc = await PC.findOne({ key: 'admin_auth' }).lean();
  const match = await bcrypt.compare(process.env.ADMIN_PASSWORD, (doc as any).value.passwordHash);
  console.log('Vérification:', match ? '✅ OK' : '❌ FAIL');

  await mongoose.disconnect();
}

fix().catch(e => { console.error(e.message); process.exit(1); });
