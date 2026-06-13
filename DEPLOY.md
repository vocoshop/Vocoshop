# ============================================
# CHECKLIST DEPLOIEMENT VOCOSHOP
# ============================================
# Date: Juin 2026
# Objectif: Mettre en ligne Vocoshop (Brazzaville)
# ============================================

## ÉTAPE 1 — Nom de domaine
- [ ] Acheter vocoshop.com (Namecheap, GoDaddy, ou autre)
- [ ] Créer les sous-domaines DNS :
  - [ ] vocoshop.com → Vercel (frontend)
  - [ ] api.vocoshop.com → IP du VPS (backend)

## ÉTAPE 2 — Backend (VPS)
- [ ] Choisir un VPS : Railway, Render, Hetzner, ou DigitalOcean
- [ ] Installer Node.js 18+ sur le VPS
- [ ] Cloner le repo vocoserver
- [ ] Copier `.env.production` en `.env` et remplir les valeurs :
  - [ ] `AT_USERNAME` → vrai username Africa's Talking
  - [ ] `VOCOSHOP_CONTACT_PHONE` → vrai numéro
  - [ ] `FLUTTERWAVE_SECRET_HASH` → vrai hash
  - [ ] `CHARIOW_*` → vraies clés
  - [ ] `SMTP_USER` + `SMTP_PASS` → vrai Gmail + mdp application
  - [ ] `CORS_ORIGINS` → vocoshop.com,https://vocoshop-vocoserver.vercel.app
- [ ] `npm install && npm run build`
- [ ] Démarrer : `node dist/server.js`
- [ ] Tester : `curl https://api.vocoshop.com/api/health`
- [ ] Configurer HTTPS (Let's Encrypt / Certbot)
- [ ] Configurer le process manager (PM2) :
  ```
  pm2 start dist/server.js --name vocoserver
  pm2 save
  pm2 startup
  ```

## ÉTAPE 3 — Frontend (Vercel)
- [ ] Importer le repo voco-web sur Vercel
- [ ] Configurer les Variables d'Environnement :
  - [ ] `NEXT_PUBLIC_API_URL` = `/api`
  - [ ] `API_BACKEND_URL` = `https://api.vocoshop.com`
- [ ] Le build passe automatiquement
- [ ] Tester : `https://vocoshop.com`

## ÉTAPE 4 — Mobile (Expo)
- [ ] Mettre à jour `vocoshop/.env` :
  ```
  EXPO_PUBLIC_API_URL=https://api.vocoshop.com
  ```
- [ ] Build APK :
  ```
  cd vocoshop
  eas build -p android --profile production
  ```
- [ ] Ou build local :
  ```
  npx expo export
  ```

## ÉTAPE 5 — Webhooks
- [ ] Flutterwave : configurer le webhook URL
  - URL : `https://api.vocoshop.com/api/webhook/flutterwave`
  - Secret Hash : `FLUTTERWAVE_SECRET_HASH`
- [ ] Chariow : configurer le webhook URL
  - URL : `https://api.vocoshop.com/api/chariow/webhook`

## ÉTAPE 6 — Africa's Talking + WhatsApp
- [ ] Créer un compte sur africastalking.com
- [ ] Remplacer `AT_USERNAME` par le vrai username
- [ ] Tester l'envoi d'OTP

### WhatsApp Cloud API (Meta)
- [ ] Créer un compte Meta Developer → developers.facebook.com
- [ ] Créer une app → "Business" → "WhatsApp"
- [ ] Obtenir un numéro WhatsApp Business
- [ ] Ajouter sur Render :
  - [ ] `WHATSAPP_TOKEN` → Token d'accès Meta (permanent)
  - [ ] `WHATSAPP_PHONE_NUMBER_ID` → ID du numéro WhatsApp
- [ ] Créer les 3 templates dans Meta Business Suite :
  - [ ] `voco_auth` → "{{1}}" (code OTP)
  - [ ] `voco_welcome` → "{{1}}" (prénom), "{{2}}" (code agent), "{{3}}" (code connexion)
  - [ ] `voco_password` → "{{1}}" (prénom), "{{2}}" (mot de passe temp)
- [ ] Templates doivent être approuvés par Meta (peut prendre 24-48h)
- [ ] Tester l'envoi WhatsApp + fallback SMS

## ÉTAPE 7 — Gmail SMTP
- [ ] Créer vocoshop.cg@gmail.com
- [ ] Activer la double authentification
- [ ] Générer un mot de passe d'application
- [ ] Remplacer `SMTP_USER` et `SMTP_PASS`

## ÉTAPE 8 — Tests finaux
- [ ] Tester inscription agent → /devenir-agent
- [ ] Tester login admin → /admin/login
- [ ] Tester login manager → /manager-login
- [ ] Tester dashboard admin → /super-admin/dashboard
- [ ] Tester dashboard agent → /agent/dashboard
- [ ] Tester un scan OCR (mobile)
- [ ] Tester un paiement (Chariow en test)
- [ ] Vérifier les logs serveur (pas d'erreurs)
- [ ] Vérifier que les CORS fonctionnent

## ÉTAPE 9 — Lancement
- [ ] Formager l'équipe terrain (10 agents)
- [ ] Préparer les kits agent (code, script de vente)
- [ ] Lancer à Brazzaville (mois 1-3)
- [ ] Surveiller les metrics dashboard
