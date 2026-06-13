import rateLimit from "express-rate-limit";

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 attempts per window
  message: { 
    error: "Trop de tentatives. Veuillez attendre 15 minutes avant de réessayer.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const otpLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 3, // 3 OTP requests per minute
  message: { 
    error: "Trop de codes demandés. Veuillez attendre avant de demander un nouveau code.",
    code: "OTP_RATE_LIMIT"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const generalLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute
  message: { 
    error: "Trop de requêtes. Veuillez ralentir.",
    code: "RATE_LIMIT_EXCEEDED"
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const partnerLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 60, // 60 requests per minute (≈ 1/sec, raisonnable pour un partenaire)
  message: {
    error: "Trop de requêtes partenaires. Veuillez ralentir.",
    code: "PARTNER_RATE_LIMIT",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const chariowCheckoutLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 3, // 3 tentatives de checkout par 5 min
  message: {
    error: "Trop de tentatives de paiement. Veuillez attendre 5 minutes.",
    code: "CHARIOW_CHECKOUT_LIMIT",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const chariowWebhookLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 30, // 30 webhooks par minute (suffisant)
  message: {
    error: "Trop de webhooks.",
    code: "CHARIOW_WEBHOOK_LIMIT",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 5, // 5 inscriptions par heure par IP
  message: {
    error: "Trop d'inscriptions. Veuillez réessayer plus tard.",
    code: "REGISTER_RATE_LIMIT",
  },
  standardHeaders: true,
  legacyHeaders: false,
});