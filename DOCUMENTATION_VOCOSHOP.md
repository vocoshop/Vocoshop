# VOCOSHOP — Documentation Complète

## Architecture

```
                      +--------------------------+
                      |     MongoDB Atlas        |
                      +------------+-------------+
                                   |
                    +--------------+--------------+
                    |                             |
         +---------v--------+        +------------v-----------+
         |    VOCOSERVER    |        |     VOCO-WEB          |
         |  Express API     |<------>|  Next.js 16           |
         |  Port 4000       |  proxy |  Port 3000/3001       |
         +---------+--------+  /api  +------------------------+
                   |
                   | REST API (JSON via ngrok)
                   |
         +---------v--------+
         |    VOCOSHOP      |
         |  Expo / RN       |
         |  Port 8081       |
         +------------------+
```

---

## 1. VOCOSERVER (Backend API)

**Stack** : Express 5 + TypeScript + MongoDB (Mongoose) + OpenAI + Fuse.js

### Lancement
```
cd vocoserver && npm run dev
```
→ Port **4000**

### Authentification
| Qui | Comment |
|-----|---------|
| **Boutique** (owner/employé) | OTP téléphone → JWT |
| **Super Admin** | Email + password (`superadmin@vocoshop.com` / `VocoShopAdmin2026!`) |
| **Admin Manager** | Email + password (`manager@vocoshop.com` / `Manager2024!`) |
| **Agent** | Email + password + OTP |

### Modules API principaux

| Module | Routes clés |
|--------|-------------|
| **Boutiques** | `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/store/me` |
| **Produits** | `CRUD /api/products`, `PATCH /api/products/:id/aliases` |
| **Ventes** | `POST /api/sales/add`, `POST /api/sales/cart`, `POST /api/sales/revert` |
| **Stock** | `POST /api/inventory/add`, `POST /api/inventory/remove`, inventaire sessions |
| **Commandes** | `CRUD /api/orders` |
| **Rapports** | `GET /api/report/kpis`, `POST /api/report/close-day` |
| **Abonnement** | `POST /api/subscription/activate`, `GET /api/subscription/me` |
| **Factures** | `GET /api/invoices/my`, `GET /api/invoices/pdf/:id` |
| **Notifications** | `GET /api/notifications`, `POST /api/push/register` |
| **Employés** | `CRUD /api/employees` |
| **Voix** | `POST /api/voice/transcribe`, `POST /api/voice/confirm`, `GET /api/voice/analytics` |
| **Paiements** | `POST /api/webhook/subscription` (Flutterwave) |
| **Admin** | `GET /api/admin/stores`, `GET /api/admin/stats`, gestion agents, retraits, config |
| **Admin Manager** | `GET /api/admin-manager/agents`, `GET /api/admin-manager/stores` |
| **Blockchain** | `GET /api/admin/blockchain/proofs` |
| **Sécurité** | `GET /api/admin/security/health`, `GET /api/admin/security/logs` |
| **IA** | `POST /api/ai/admin-chat`, `POST /api/ai/suggest-category` |

### Modèles BDD (33 collections)

| Modèle | Rôle |
|--------|------|
| **Store** | Boutiques inscrites (abonnement, parrainage, activité) |
| **User** | Employés des boutiques (rôles, permissions) |
| **Product** | Produits (prix, stock, alias vocaux, popularité) |
| **Sales** | Transactions de vente |
| **DailyReport** | Rapport de clôture journalier |
| **InventorySession** | Sessions d'inventaire physique |
| **Order** | Commandes fournisseurs |
| **Invoice** | Factures d'abonnement (3900 XAF) |
| **Agent** | Agents terrain (commissions, approbation) |
| **Commission** | Commissions agent (800 XAF/boutique/mois) |
| **Withdrawal** | Retraits agents (validation auto) |
| **Subscription** | États d'abonnement (trial, active, expired) |
| **Notification** | Alertes stock, expiration, système |
| **VoiceLog** | Historique des commandes vocales |
| **VoiceLearning** | Apprentissage des prononciations |
| **BlockchainProof** | Preuves d'intégrité (SHA-256 + blockchain) |
| **PlatformConfig** | Configuration globale de la plateforme (+21 settings) |
| **SupportTicket** | Tickets de support |
| **AdminManager** | Gestionnaires admin régionaux |

### Services clés

| Service | Fonction |
|---------|----------|
| **voiceService.ts** | VocoVoice Engine™ — transcription Whisper + Fuse.js fuzzy matching + apprentissage |
| **paymentGateway.ts** | Intégration Flutterwave v3 (Mobile Money MTN/Orange/Airtel + Cartes) |
| **subscriptionEngine.ts** | Machine à états : trial → actif → grace → expiré → bloqué |
| **securityMonitor.ts** | Score de sécurité, détection menaces, logs |
| **blockchainAnchorService.ts** | Hachage SHA-256 + ancrage optionnel Polygon |
| **commissionService.ts** | Génération des commissions agents |
| **pdfInvoiceService.ts** | Génération PDF factures avec QR code |
| **pushNotificationService.ts** | Expo Push Notifications |
| **smsService.ts** | Africa's Talking SMS |
| **aiCommandExecutor.ts** | VocoAI — exécution commandes admin via chat |
| **platformAnalyzer.ts** | Analytics plateforme (MRR, churn, top villes) |
| **storeUsageEngine.ts** | Analyse activité boutique |

---

## 2. VOCOSHOP (Application Mobile)

**Stack** : React Native + Expo SDK 54 + TypeScript

### Lancement
```
cd vocoshop && npx expo start
```
→ Scanner QR code avec Expo Go ou build native

### Navigation (Stack)

#### Écrans principaux (57 screens)

| Écran | Fonction |
|-------|----------|
| **Accueil** | Dashboard boutique : KPIs (ventes, stock, CA), alertes stock faible, notifications |
| **Inventaire** | Gestion produits, inventaire physique, stock |
| **Ventes** | Enregistrement vente, panier, annulation (undo) |
| **Stock** | Ajout/retrait stock, expiration, alertes |
| **Commandes** | CRUD commandes fournisseurs |
| **Rapports** | Rapport journalier, clôture de caisse |
| **Profil** | Infos boutique, abonnement, employés |
| **Voix** | Commande vocale overlay (VocoVoice Engine) |

#### VocoVoice Engine™ (intégré)

1. Tap micro → enregistrement audio (22050Hz mono 32kbps AAC)
2. Envoi à `/api/voice/transcribe`
3. Backend : transcription Whisper + Fuse.js fuzzy matching + apprentissage
4. Overlay affiche : action détectée + boutons Valider/Annuler
5. TTS répète la commande : "Tu veux vendre 2 Coca-Cola ?"
6. Confirmation → exécution API

**Commandes vocales supportées** :
- `"vends 2 coca"` / `"ajoute 10 savons"` / `"retire 5 riz"`
- Multi : `"2 coca + 3 amsterdam"` / `"5 savon et 10 riz"` / `"2 coca 3 amsterdam"`
- `"annule"` (undo dernière action)
- `"commande 10 carton"` / `"cherche riz"` / `"vérifie stock mayonnaise"`

#### API mobile (axios)
- **Base URL** : `https://unglozed-supermetropolitan-tamar.ngrok-free.dev`
- Header auto : `ngrok-skip-browser-warning: true`
- Auth : JWT dans `Authorization: Bearer`
- Intercepteurs : 402 → page abonnement, 401 → reconnexion

---

## 3. VOCO-WEB (Dashboards Web)

**Stack** : Next.js 16 + TypeScript + Tailwind CSS 4

### Lancement
```
cd voco-web && next dev --webpack
```
→ Port **3000** (ou 3001 si occupé)

### Proxy API
`next.config.ts` : `/api/:path*` → `http://localhost:4000/api/:path*`

### Pages

#### Super Admin (`/super-admin`)
| Page | Fonction |
|------|----------|
| `/dashboard` | KPIs plateforme : boutiques, CA, abonnés, graphiques 30j |
| `/agents` | Gestion agents (création, approbation, suspension) |
| `/boutiques` | Toutes les boutiques (filtres, recherche) |
| `/abonnements` | États d'abonnement, stats conversion |
| `/paiements` | Historique paiements Flutterwave |
| `/analytics` | Analytics avancés (MRR, churn, top villes) |
| `/notifications` | Envoi push/SMS broadcast |
| `/support` | Tickets support (réponse, statut) |
| `/parametres` | Configuration plateforme (prix, essai, sécurité) |
| `/securite` | Monitoring sécurité (score, logs, alertes) |
| `/logs` | Logs système (erreurs, webhook, performances) |
| `/preuves` | Preuves blockchain (intégrité données) |
| `/parrainages` | Programme de parrainage |
| `/admin-managers` | Gestion des admin managers |
| `/AIAgent` | Chat IA (VocoAI) : commandes admin en langage naturel |

#### Admin Manager (`/admin-manager`)
| Page | Fonction |
|------|----------|
| `/dashboard` | KPIs région : boutiques, agents, objectifs |
| `/agents` | Agents de sa zone |
| `/boutiques` | Boutiques de sa zone |
| `/alertes` | Alertes (inactivité, stock, abonnement) |
| `/performances` | Graphiques performances agents |
| `/comparer` | Comparaison agents (score, ventes) |
| `/support` | Tickets support région |
| `/notifications` | Notifications push agents |
| `/parametres` | Profil manager |

#### Agent (`/agent`)
| Page | Fonction |
|------|----------|
| `/dashboard` | Ses boutiques, commissions, objectifs |

#### Public
| Page | Fonction |
|------|----------|
| `/` | Dashboard agent (si connecté) |
| `/login` | Connexion agent |
| `/manager-login` | Connexion admin manager |
| `/devenir-agent` | Inscription agent |
| `/admin/login` | Connexion super admin |

---

## 4. Connexion entre plateformes

### Mobile ↔ API
```
vocoshop (Expo)  ──axios──►  vocoserver:4000  ──mongoose──► MongoDB Atlas
                            (via ngrok tunnel)
```

### Web ↔ API
```
voco-web (Next.js)  ──rewrite /api──►  vocoserver:4000  ──mongoose──► MongoDB Atlas
```

### Flux d'authentification
```
1. OTP téléphone (Mobile) → /api/otp/send → /api/auth/login
2. JWT stocké → attaché à chaque requête
3. authMiddleware vérifie :
   - Token valide
   - Abonnement actif (sinon 402)
   - Réauthentification si inactif 14j
```

### Flux de paiement
```
Mobile: Activation → /api/subscription/activate
       → Flutterwave (Mobile Money / Carte)
       → Webhook → /api/webhook/subscription
       → Subscription activée
       → Commission agent créée (800 XAF)
```

---

## 5. Démarrage rapide

### Démarrer tout

```bash
# Terminal 1 - Backend
cd MON PROJET/vocoserver && npm run dev

# Terminal 2 - Web dashboards
cd MON PROJET/voco-web && next dev --webpack

# Terminal 3 - Mobile (optionnel, avec Expo Go)
cd MON PROJET/vocoshop && npx expo start
```

### Ports
| Service | Port |
|---------|------|
| vocoserver (API) | 4000 |
| voco-web (Next.js) | 3000 |
| vocoshop (Expo) | 8081 |
| Tunnel ngrok | 4000 → ngrok |

### Identifiants

| Rôle | Email/Phone | Mot de passe |
|------|-------------|--------------|
| Super Admin | `superadmin@vocoshop.com` | `VocoShopAdmin2026!` |
| Admin Manager | `manager@vocoshop.com` | `Manager2024!` |
| Boutique | OTP téléphone | — |

---

## 6. Fonctionnalités clés

### VocoVoice Engine™
- Reconnaissance vocale intelligente spécialisée accents africains
- Fuzzy matching produits (Fuse.js) : `"premisse"` → `"Primus"`
- Apprentissage automatique des prononciations
- Multi-produits : `"2 coca + 3 amsterdam"` ou `"2 coca 3 amsterdam"`
- Confirmation obligatoire avant exécution
- Historique + analytics vocaux

### VocoAI™
- Chat en langage naturel pour super admin
- Commandes : suspendre boutique, approuver agent, étendre abonnement
- Suggestion de catégorie produit par IA

### Paiements intégrés
- Orange Money / MTN Mobile Money / Airtel Money / Moov
- Cartes Visa/Mastercard
- Abonnement 3900 XAF/mois, essai 30 jours
- Commissions agents : 800 XAF/boutique active/mois

### Rapports & Analytics
- Rapport journalier automatisé (clôture caisse)
- KPIs vente, marge, stock
- Graphiques 14j, 30j
- Partage lien sécurisé avec hash SHA-256

### Blockchain
- Preuves d'intégrité des rapports partagés
- SHA-256 + chaîne de hachage (Merkle-style)
- Ancrage optionnel sur Polygon/Ethereum

### Sécurité
- Rate limiting : auth (5/15min), OTP, général
- Réauthentification après 14 jours inactivité
- Score de sécurité plateforme
- Logs système détaillés
- Journalisation toutes requêtes

### Abonnement
- Trial : 30 jours gratuits
- Période de grâce : 7 jours après expiration
- Renouvellement automatique
- Blocage si impayé
- Extension manuelle par super admin
