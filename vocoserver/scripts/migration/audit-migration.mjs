/**
=====================================================
🔍 AUDIT MIGRATION MongoDB — LECTURE SEULE
=====================================================
Aucune écriture. Aucune suppression. Aucune création.

Usage :
  node audit-migration.mjs compare   <BASE_A> <BASE_B>   (ex: test vocoshop-prod)
  node audit-migration.mjs inventory <BASE>                (collections + counts + indexes)
  node audit-migration.mjs integrity <BASE>                (index flags + orphans)

Obligatoire : l'IP de cette machine doit être whitelistée sur Atlas.
=====================================================
*/
import { MongoClient } from "mongodb";

const uri = process.env.MONGO_URI;
if (!uri) {
  console.error("ERREUR : variable MONGO_URI absente.");
  process.exit(1);
}

const mode = process.argv[2];
const argA = process.argv[3];
const argB = process.argv[4];

if (!mode || !argA) {
  console.error("Usage : node audit-migration.mjs <compare|inventory|integrity> <baseA> [baseB]");
  process.exit(1);
}

/* Résout une base sans jamaislarobuster le chemin de l'URI. */
function uriFor(dbName) {
  const u = new URL(uri.replace("mongodb+srv://", "https://").replace("mongodb://", "http://"));
  const scheme = uri.startsWith("mongodb+srv://") ? "mongodb+srv" : "mongodb";
  u.pathname = `/${encodeURIComponent(dbName)}`;
  u.search = "";
  const auth = uri.includes("@") ? uri.slice(0, uri.indexOf("@")) : "";
  const authPart = auth ? `${auth.split("/")[2]}@` : "";
  return `${scheme}://${authPart}${u.host}${u.pathname}?appName=vocoshop-audit`;
}

async function withDb(dbName, fn) {
  const client = new MongoClient(uriFor(dbName), {
    serverSelectionTimeoutMS: 15000,
    directConnection: false,
  });
  await client.connect();
  try {
    return await fn(client.db(dbName));
  } finally {
    await client.close();
  }
}

const listCollections = async (db) =>
  (await db.listCollections({}, { nameOnly: true }).toArray())
    .map((c) => c.name)
    .filter((n) => !n.startsWith("system."))
    .sort();

async function inventory(dbName) {
  return withDb(dbName, async (db) => {
    const names = await listCollections(db);
    const rows = [];
    for (const name of names) {
      const count = await db.collection(name).countDocuments({});
      const idx = await db.collection(name).indexes();
      rows.push({ collection: name, documents: count, indexes: idx.map((i) => i.name) });
    }
    return rows;
  });
}

async function compare(aName, bName) {
  const [a, b] = await Promise.all([inventory(aName), inventory(bName)]);

  const mapA = new Map(a.map((r) => [r.collection, r]));
  const mapB = new Map(b.map((r) => [r.collection, r]));
  const all = [...new Set([...mapA.keys(), ...mapB.keys()])].sort();

  let mismatches = 0;
  let onlyA = 0;
  let onlyB = 0;
  let idxMissing = 0;

  console.log("\n╔══════════════════════════════════════════════════════════════════════╗");
  console.log("║            COMPARAISON " + aName.toUpperCase() + " → " + bName.toUpperCase());
  console.log("╚══════════════════════════════════════════════════════════════════════╝\n");
  console.log(
    "collection".padEnd(26) +
    aName.slice(0, 12).padEnd(14) +
    bName.slice(0, 12).padEnd(14) +
    "verdict"
  );
  console.log("─".repeat(80));

  for (const name of all) {
    const ra = mapA.get(name);
    const rb = mapB.get(name);
    let verdict;

    if (!rb) {
      verdict = "ABSENTE EN B";
      onlyA++;
      mismatches++;
    } else if (!ra) {
      verdict = "ABSENTE EN A";
      onlyB++;
      mismatches++;
    } else if (ra.documents !== rb.documents) {
      verdict = `ECART (${ra.documents - rb.documents})`;
      mismatches++;
    } else {
      const missing = ra.indexes.filter((i) => !rb.indexes.includes(i));
      if (missing.length) {
        verdict = `INDEX MANQUANTS: ${missing.join(", ")}`;
        idxMissing++;
        mismatches++;
      } else {
        verdict = "OK";
      }
    }

    console.log(
      name.padEnd(26) +
      (ra ? String(ra.documents) : "-").padEnd(14) +
      (rb ? String(rb.documents) : "-").padEnd(14) +
      verdict
    );
  }

  const totalA = a.reduce((s, r) => s + r.documents, 0);
  const totalB = b.reduce((s, r) => s + r.documents, 0);

  console.log("\n" + "═".repeat(80));
  console.log(`Documents ${aName}   : ${totalA}`);
  console.log(`Documents ${bName}   : ${totalB}`);
  console.log(`Différence          : ${totalA - totalB}`);
  console.log(`Collections         : ${all.length} (${onlyA} absentes en B, ${onlyB} absentes en A)`);
  console.log(`Index manquants     : ${idxMissing}`);
  console.log("═".repeat(80));

  if (mismatches === 0) {
    console.log("\n✅ PARFAIT : collections, volumes et index concordent.\n");
  } else {
    console.log(`\n❌ ${mismatches} DIVERGENCE(S) — NE PAS BASCULER MONGO_URI.\n`);
  }
  return mismatches === 0;
}

async function integrity(dbName) {
  return withDb(dbName, async (db) => {
    const names = await listCollections(db);
    console.log(`\n── INDEX ET INTÉGRITÉ (${dbName}) ──\n`);

    for (const name of names) {
      const idx = await db.collection(name).indexes();
      const lines = idx.map((i) => {
        const flags = [];
        if (i.unique) flags.push("unique");
        if (i.sparse) flags.push("sparse");
        if (i.partialFilterExpression) flags.push("partial");
        const keys = Object.entries(i.key || {})
          .map(([k, v]) => `${k}:${v}`)
          .join(",");
        return `      ${i.name.padEnd(34)} { ${keys} }${flags.length ? "  [" + flags.join(", ") + "]" : ""}`;
      });
      console.log(`  ${name} (${idx.length} index)`);
      console.log(lines.join("\n"));
    }

    /* publicToken : la capability URL des factures */
    const inv = db.collection("factures");
    const total = await inv.countDocuments({});
    const withToken = await inv.countDocuments({
      publicToken: { $type: "string", $ne: "" },
    });
    const missing = await inv.countDocuments({
      $or: [{ publicToken: { $exists: false } }, { publicToken: "" }],
    });

    console.log(`\n── FACTURES / publicToken ──`);
    console.log(`  total factures        : ${total}`);
    console.log(`  avec jeton            : ${withToken}`);
    console.log(`  SANS jeton (backfill) : ${missing}`);
    if (total > 0 && missing === total) {
      console.log(`  ℹ️  Aucune facture n'a de jeton : le backfill lazy le créera au 1er PDF.`);
    } else if (missing > 0) {
      console.log(`  ⚠️  ${missing} facture(s) sans jeton : leur ancien QR code ne fonctionnera plus.`);
    }
  });
}

const ok =
  mode === "inventory" ? await inventory(argA).then((r) => {
    console.log(`\n── INVENTAIRE (${argA}) ──\n`);
    for (const x of r) {
      console.log(`  ${x.collection.padEnd(26)} ${String(x.documents).padStart(8)} docs  ${x.indexes.length} idx`);
    }
    return true;
  })
  : mode === "compare" ? await compare(argA, argB)
  : mode === "integrity" ? await integrity(argA)
  : (console.error(`Mode inconnu : ${mode}`), false);

process.exit(ok ? 0 : 1);