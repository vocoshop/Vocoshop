// server.ts
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import dotenv from "dotenv";
import morgan from "morgan";
import path from "path";

import productRoutes from "./routes/productRoutes";
import inventoryRoutes from "./routes/inventoryRoutes";
import authRoutes from "./routes/authRoutes";
import otpRoutes from "./routes/otpRoutes";
import aiRoutes from "./routes/aiRoutes";
import { authLimiter, otpLimiter, generalLimiter } from "./middleware/rateLimiter";

import stockRoutes from "./routes/stockRoutes";
import stockHistoryRoutes from "./routes/stockHistoryRoutes";

import reportRoutes from "./routes/reportRoutes";
import publicReportRoutes from "./routes/publicReportRoutes";

import orderRoutes from "./routes/orderRoutes";
import salesRoutes from "./routes/salesRoutes";
import supplierRoutes from "./routes/supplierRoutes";

import storeRoutes from "./routes/storeRoutes";
import storeAnalysisRoutes from "./routes/storeAnalysisRoutes";

import employeeRoutes from "./routes/employeeRoutes";
import publicInviteRoutes from "./routes/publicInviteRoutes";

import agentRoutes from "./routes/agentRoutes";
import agentAdminRoutes from "./routes/agentAdminRoutes";
import publicAgentRoutes from "./routes/publicAgentRoutes";
import agentWithdrawalRoutes from "./routes/agentWithdrawalRoutes";
import activityRoutes from "./routes/activityRoutes";
import adminStoreRoutes from "./routes/adminStoreRoutes";
import adminAuthRoutes from "./routes/adminAuthRoutes";
import adminWithdrawalRoutes from "./routes/adminWithdrawalRoutes";
import adminNotificationRoutes from "./routes/adminNotificationRoutes";
import adminSupportRoutes from "./routes/adminSupportRoutes";
import adminConfigRoutes from "./routes/adminConfigRoutes";

import { storeActivityTracker } from "./middleware/storeActivityTracker";
import subscriptionRoutes from "./routes/subscriptionRoutes";
import paymentWebhookRoutes from "./routes/paymentWebhookRoutes";
import chariowRoutes from "./routes/chariowRoutes";
import notificationRoutes from "./routes/notificationRoutes";
import { startNotificationScheduler } from "./scheduler/notificationScheduler";
import { startSubscriptionRenewalScheduler } from "./scheduler/subscriptionRenewalScheduler";
import realtimeRoutes, { broadcastSSE } from "./routes/realtimeRoutes";
import systemLoggerMiddleware from "./middleware/systemLogger";
import { seedPlatformConfig } from "./services/seedPlatformConfig";
import invoiceRoutes from "./routes/invoiceRoutes";
import pushRoutes from "./routes/pushRoutes";
import adminManagerRoutes from "./routes/adminManagerRoutes";
import adminSecurityRoutes from "./routes/adminSecurityRoutes";
import adminBlockchainRoutes from "./routes/adminBlockchainRoutes";
import adminPartnerRoutes from "./routes/adminPartnerRoutes";
import blockchainRoutes from "./routes/blockchainRoutes";
import partnerRoutes from "./routes/partnerRoutes";
import { checkBlockchainRpcAvailability } from "./services/blockchainAnchorService";
import managerAuthRoutes from "./routes/managerAuthRoutes";
import managerRoutes from "./routes/managerRoutes";
import managerSupportRoutes from "./routes/managerSupportRoutes";
import ocrRoutes from "./routes/ocrRoutes";
import callProxyRoutes from "./routes/callProxyRoutes";
import fundingRoutes from "./routes/fundingRoutes";

import { patchConsole } from "./utils/systemLogger";
patchConsole();

dotenv.config();

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error("❌ JWT_SECRET manquant ou trop court (min 16 caractères). Arrêt.");
  process.exit(1);
}

const app = express();

app.disable("etag"); // Désactive les ETags pour éviter les problèmes de cache sur les PUT/PATCH récents

const allowedOrigins = (process.env.CORS_ORIGINS || "").split(",").filter(Boolean);
app.use(cors({
  origin: allowedOrigins.length > 0 ? allowedOrigins : false,
  credentials: true,
}));
app.use(express.json({ limit: "10mb" }));
app.use(morgan("dev"));
app.use(systemLoggerMiddleware);

app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use("/uploads", express.static(path.join(__dirname, "../uploads")));

app.get("/", (req, res) => {
res.send("VocoServer API Running ✔️");
});

app.get("/invite", (req, res) => {
const token = String(req.query.token || "");
if (!token) return res.status(400).send("Token manquant");

const expoBase = process.env.EXPO_DEEP_LINK_BASE;
if (!expoBase) return res.status(500).send("EXPO_DEEP_LINK_BASE manquant");

const redirectUrl = `${expoBase}/--/invite?token=${encodeURIComponent(token)}`;
return res.redirect(302, redirectUrl);
});

// AUTH / OTP / IA (AVEC RATE LIMITING)
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/otp", otpLimiter, otpRoutes);
app.use("/api/ai", generalLimiter, aiRoutes);

// PUBLIC
app.use("/api/public/report", publicReportRoutes);
app.use("/api/public", publicInviteRoutes);
app.use("/api/public/agent", publicAgentRoutes);

// PRIVÉ (APP boutique)
app.use("/api/products", productRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/stocks", stockRoutes);
app.use("/api/stock-history", stockHistoryRoutes);
app.use("/api/report", reportRoutes);
app.use("/api/orders", orderRoutes);
app.use("/api/sales", salesRoutes);
app.use("/api/suppliers", supplierRoutes);

// ✅ STORE
app.use("/api/store", storeRoutes);
app.use(storeActivityTracker); // Middleware global pour tracker l'activité boutique
app.use("/api/subscription", subscriptionRoutes); // ✅ route abonnement (doit être après le tracker pour compter l'activité)
app.use("/api/notifications", notificationRoutes); // ✅ route notifications (doit être après le tracker pour compter l'activité)
app.use("/api/push", pushRoutes); // ✅ push tokens
app.use("/api/invoices", invoiceRoutes); // ✅ route factures (doit être après le tracker pour compter l'activité)
// ✅ PATCH RECOMMANDÉ
app.use("/api/store/analysis", storeAnalysisRoutes);

app.use("/api/employees", employeeRoutes);

// ✅ AGENT (site web)
app.use("/api/agent", agentRoutes);
app.use("/api/agent/withdrawals", agentWithdrawalRoutes);
app.use("/api/agent/activity", activityRoutes);

// ✅ ADMIN OWNER: agents
app.use("/api/admin/auth", adminAuthRoutes);
app.use("/api/admin/agents", agentAdminRoutes);
app.use("/api/admin", adminStoreRoutes);
app.use("/api/admin/withdrawals", adminWithdrawalRoutes);
app.use("/api/admin/notifications", adminNotificationRoutes);
app.use("/api/admin/support", adminSupportRoutes);
app.use("/api/admin/config", adminConfigRoutes);
app.use("/api/admin/security", adminSecurityRoutes);
app.use("/api/admin/blockchain", adminBlockchainRoutes);
app.use("/api/admin", adminPartnerRoutes);
app.use("/api/blockchain", blockchainRoutes);
app.use("/api/partner", partnerRoutes);
app.use("/api/admin", adminManagerRoutes);
app.use("/api/admin-manager/auth", managerAuthRoutes);
app.use("/api/admin-manager", managerRoutes);
app.use("/api/realtime", realtimeRoutes);
app.use("/api/ocr", ocrRoutes);
app.use("/api/funding", fundingRoutes);
app.use("/api/call-proxy", callProxyRoutes);
app.use("/api/manager/support", managerSupportRoutes);
app.use("/api/webhook", paymentWebhookRoutes);
app.use("/api/chariow", chariowRoutes);


// ERROR HANDLER
app.use((err: any, req: any, res: any, next: any) => {
console.error("🔥 SERVER ERROR:", err);
res.status(500).json({ error: "Erreur interne serveur" });
});

// DB
mongoose
.connect(process.env.MONGO_URI as string)
.then(async () => {
  console.log("🚀 MongoDB connecté avec succès");
  await seedPlatformConfig().catch(() => {});
})
.catch((err) => console.log("❌ Erreur MongoDB :", err));

// START
const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
console.log(`🔥 Serveur démarré sur le port ${PORT}`)
);

// 🚀 DÉMARRAGE MOTEUR NOTIFICATIONS
startNotificationScheduler();
// 🚀 DÉMARRAGE RENOUVELLEMENTS AUTOMATIQUES
startSubscriptionRenewalScheduler();

// 🚀 VÉRIFICATION RPC BLOCKCHAIN
checkBlockchainRpcAvailability();
