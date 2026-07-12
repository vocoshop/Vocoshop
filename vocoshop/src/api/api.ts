// src/api/api.ts

import axios from "axios";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { navigate } from "./navigation/navigationRef";

/**
 * 🔥 BASE API
 * IMPORTANT :
 * - PAS de /api ici
 * - Le /api est ajouté dans baseURL
 * - Utiliser EXPO_PUBLIC_API_URL en production
 */
const envUrl = process.env.EXPO_PUBLIC_API_URL;
const extraUrl = (Constants.expoConfig as any)?.extra?.EXPO_PUBLIC_API_URL;
const manifestUrl = (Constants as any)?.manifest?.extra?.EXPO_PUBLIC_API_URL;
export const API_BASE = envUrl || extraUrl || manifestUrl || "https://vocoshop.onrender.com";
if (__DEV__) console.warn("🔗 API_BASE =", API_BASE);

/**
 * 🚀 INSTANCE AXIOS PRINCIPALE
 */
const API = axios.create({
  baseURL: `${API_BASE}/api`,
  timeout: 30000,
});

/* =====================================================
🔐 REQUEST INTERCEPTOR — TOKEN AUTO
===================================================== */
API.interceptors.request.use(
async (config: any) => {
try {
const token = await AsyncStorage.getItem("token");

if (token) {
config.headers = {
...(config.headers || {}),
Authorization: `Bearer ${token}`,
};
}
} catch (e) {
console.log("⚠️ Token read error:", e);
}

return config;
},
(error) => Promise.reject(error)
);

/* =====================================================
🔥 RESPONSE INTERCEPTOR — GLOBAL GUARD ABONNEMENT
===================================================== */

let isRedirectingSubscription = false; // 🔥 anti boucle

API.interceptors.response.use(
(response) => response,

async (error) => {
const status = error?.response?.status;
const code = error?.response?.data?.code;

/* =====================================================
🚫 ABONNEMENT REQUIS — REDIRECTION AUTO
===================================================== */
if (status === 402 && code === "SUBSCRIPTION_REQUIRED") {
console.log("🚫 Abonnement requis — redirection globale");

/**
* 🔥 ULTRA SAFE :
* évite navigation multiple
* évite boucle infinie axios
*/
if (!isRedirectingSubscription) {
isRedirectingSubscription = true;

try {
navigate("SubscriptionBlocked");
} catch {}

// reset léger après navigation
setTimeout(() => {
isRedirectingSubscription = false;
}, 800);
}
}

/* =====================================================
 🔐 TOKEN INVALID — LOGOUT AUTO
 ===================================================== */
if (status === 401) {
  console.log("🔐 Token invalide — logout automatique");
  try {
    navigate("Login");
  } catch {}
}

return Promise.reject(error);
}
);

export default API;
