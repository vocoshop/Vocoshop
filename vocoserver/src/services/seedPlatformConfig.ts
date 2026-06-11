import PlatformConfig from "../models/PlatformConfig";

const defaultConfig = [
  // General
  { key: "platform_name", value: "VocoShop", type: "string", category: "general", label: "Nom plateforme", description: "Nom affiché dans les emails et notifications" },
  { key: "support_email", value: process.env.SUPPORT_EMAIL || "support@vocoshop.com", type: "string", category: "general", label: "Email support", description: "Email de contact support" },
  { key: "default_language", value: "fr", type: "string", category: "general", label: "Langue par défaut", description: "Code langue ISO (fr, en)" },
  { key: "timezone", value: "Africa/Douala", type: "string", category: "general", label: "Fuseau horaire", description: "Timezone serveur" },

  // Pricing
  { key: "trial_days", value: 30, type: "number", category: "pricing", label: "Jours essai gratuit", description: "Durée de la période d'essai en jours" },
  { key: "monthly_price", value: 3900, type: "number", category: "pricing", label: "Prix mensuel", description: "Prix abonnement mensuel en XAF" },
  { key: "annual_price", value: 39000, type: "number", category: "pricing", label: "Prix annuel", description: "Prix abonnement annuel en XAF (2 mois offerts)" },
  { key: "billing_cycle", value: "monthly", type: "string", category: "pricing", label: "Cycle facturation", description: "monthly ou annual" },

  // Payment
  { key: "commission_per_store", value: 800, type: "number", category: "payment", label: "Commission agent/boutique", description: "XAF par boutique active/mois" },
  { key: "min_withdrawal", value: 1000, type: "number", category: "payment", label: "Seuil min retrait", description: "XAF minimum pour retrait" },
  { key: "withdrawal_fee_percent", value: 2, type: "number", category: "payment", label: "Frais retrait (%)", description: "Pourcentage prélevé sur chaque retrait" },
  { key: "auto_approve_withdrawal", value: false, type: "boolean", category: "payment", label: "Auto-approuver retraits", description: "Approuve automatiquement si le solde le permet" },

  // Referral
  { key: "paid_referrals_for_bonus", value: 3, type: "number", category: "referral", label: "Filleuls pour bonus", description: "Nombre de filleuls payants pour 1 mois gratuit" },
  { key: "bonus_type", value: "free_month", type: "string", category: "referral", label: "Type bonus", description: "free_month = 1 mois gratuit" },
  { key: "max_referrals_per_month", value: 10, type: "number", category: "referral", label: "Max filleuls/mois", description: "Limite de filleuls par mois" },
  { key: "referral_validation_days", value: 30, type: "number", category: "referral", label: "Période validation", description: "Jours pour valider un filleul comme付费" },

  // Security
  { key: "max_login_attempts", value: 5, type: "number", category: "security", label: "Tentatives max connexion", description: "Blocage après ce nombre d'échecs" },
  { key: "login_block_duration_min", value: 15, type: "number", category: "security", label: "Durée blocage (min)", description: "Minutes de blocage après max tentatives" },
  { key: "jwt_expiry_days", value: 7, type: "number", category: "security", label: "Token JWT expiry", description: "Jours avant expiration du token" },
  { key: "enable_security_logs", value: true, type: "boolean", category: "security", label: "Logs sécurité", description: "Activer la journalisation de sécurité" },
  { key: "enable_system_logs", value: true, type: "boolean", category: "security", label: "Logs système", description: "Activer la journalisation système" },
  { key: "system_logs_ttl_days", value: 30, type: "number", category: "security", label: "Logs système TTL", description: "Jours avant expiration des logs système" },

  // Webhooks
  { key: "webhook_payment_enabled", value: true, type: "boolean", category: "webhooks", label: "Webhook paiement", description: "Notification lors d'un paiement reçu" },
  { key: "webhook_subscription_enabled", value: true, type: "boolean", category: "webhooks", label: "Webhook abonnement", description: "Notification lors d'un abonnement créé/expiré" },
  { key: "webhook_withdrawal_enabled", value: true, type: "boolean", category: "webhooks", label: "Webhook retrait", description: "Notification lors d'un retrait approuvé" },
];

export async function seedPlatformConfig() {
  for (const item of defaultConfig) {
    await PlatformConfig.findOneAndUpdate(
      { key: item.key },
      { $set: item },
      { upsert: true, new: true }
    );
  }
}

export default seedPlatformConfig;