# Migration MongoDB : `test` → `vocoshop-prod`

Préparation en lecture seule. Rien n'a été exécuté sur le cluster.

## Diagnostic

| | |
|---|---|
| Base utilisée par Railway | `test` |
| Origine | `MONGO_URI` sans nom de base → défaut du driver |
| Preuve | `vocoserver/src/server.ts:246` — `mongoose.connect(MONGO_URI, {…})`, aucun `dbName` |
| Portée | cosmétique — aucun code ne référence `"test"` |

Les 3 scripts de `vocoserver/scripts/migration/` sont prêts :

| Script | Action | Écrit ? |
|---|---|---|
| `backup-db.mjs` | dump `test` → `.bson` + manifeste | non (source) |
| `restore-db.mjs` | restore vers la base cible | **oui (cible)** |
| `audit-migration.mjs` | inventaire / comparaison / intégrité | non |
| `smoke-test.mjs` | preuves fonctionnelles via les vrais modèles | non |

## Prérequis

1. **Whitelist Atlas** — ajouter l'IP de la machine qui exécute les scripts.
2. **Backup Atlas** — activer un snapshot automatique dans le cluster, en filet de sécurité.

## Étapes 1 à 5 — avant toute bascule

### 1. Inventaire de la source

```powershell
cd C:\Users\PC\Desktop\MON PROJET\vocoserver
$env:MONGO_URI = "<URI Railway actuelle, SANS nom de base>"
node scripts\migration\audit-migration.mjs inventory test
```

Note : `backup-db.mjs` écrit dans `vocoserver/backups/` (exclu du dépôt).

### 2. Backup complet de `test`

```powershell
node scripts\migration\backup-db.mjs test
```

Sortie : `backups/test-<timestamp>.bson` + `.manifest.json`.
Vérifier que la somme des collections correspond à l'étape 1.

### 3. Restore vers `vocoshop-prod`

```powershell
node scripts\migration\restore-db.mjs vocoshop-prod "backups\test-<timestamp>.bson"
```

Garde-fous intégrés :
- refus si la cible est `test`
- refus si la cible contient déjà des documents
- arrêt si le backup est tronqué

**Les index ne sont pas copiés** — c'est normal, l'étape 4 les recrée.

### 4. Index + comparaison

```powershell
node scripts\migration\restore-db.mjs ...   # déjà fait
$env:MONGO_URI = "<URI avec /vocoshop-prod>"
npm run db:indexes
node scripts\migration\audit-migration.mjs compare test vocoshop-prod
node scripts\migration\audit-migration.mjs integrity vocoshop-prod
```

`compare` doit afficher `✅ PARFAIT` : collections, volumes **et index** concordants.

Vérification ciblée de `publicToken_1` sur `factures` :
l'index est inclus dans la comparaison automatique, et `smoke-test.mjs` le contrôle aussi.

### 5. Test fonctionnel sur `vocoshop-prod`

```powershell
node scripts\migration\smoke-test.mjs vocoshop-prod
```

Contrôle via les **vrais modèles Mongoose** : owner bcrypt, boutique, factures, résolution de la capability URL (`invoiceNumber` + `publicToken`) et présence des index.

Attendu : `0 ÉCHEC`.

## Étape 6 — bascule Railway (validation requise)

```powershell
railway variables --set "MONGO_URI=mongodb+srv://vocoshop-prod:***@vocoshop-prod.me00mtg.mongodb.net/vocoshop-prod?appName=vocoshop-prod"
```

Puis redeploy, puis re-tester : login panel, factures, `/api/invoices/public/…`.

## Étape 7 — suppression de `test`

Uniquement après validation complète de la production. Cette étape est **irréversible**.

## Retour arrière

Tant que `test` n'est pas supprimée, rebascule :

```powershell
railway variables --set "MONGO_URI=<URI sans nom de base>"
```

Les données sont toujours là. C'est le filet de sécurité de toute l'opération.

## Notes

- `test` ne peut pas être renommée : Atlas n'autorise pas `renameCollection` en self-service. D'où la copie.
- Après bascule, `test` reste présente sur le cluster : elle contiendra les données jusqu'à sa suppression.
- Un rôle MongoDB **en lecture seule** serait utile pour les diagnostics futurs.