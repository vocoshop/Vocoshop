import React, { createContext, useContext, useEffect, useState } from "react";
import API from "../api";
import { AuthContext } from "./AuthContext";
import { AppState } from "react-native";

/* =====================================================
🧾 TYPES — V15 REALTIME READY
===================================================== */

type SubscriptionType = {
status?: string;
subscriptionStatus?: string;
access?: boolean;
message?: string;
installedAt?: string;
graceUntil?: string;
plan?: string;
paidUntil?: string;
};

type SubscriptionContextType = {
subscription: SubscriptionType | null;
refreshSubscription: () => Promise<void>;
};

/* =====================================================
🧠 CONTEXT
===================================================== */

export const SubscriptionContext = createContext<SubscriptionContextType>({
subscription: null,
refreshSubscription: async () => {},
});

/* =====================================================
🚀 PROVIDER
===================================================== */

export const SubscriptionProvider = ({ children }: any) => {
const { token } = useContext(AuthContext);

const [subscription, setSubscription] =
useState<SubscriptionType | null>(null);

/* =====================================================
🔄 FETCH ABONNEMENT — V15 ULTRA SAFE
===================================================== */

const refreshSubscription = async () => {
try {

if (!token) {
setSubscription(null);
return;
}

const res: any = await API.get("/subscription/me");

if (!res?.data) {
setSubscription(null);
return;
}

/**
* ⭐⭐⭐ FIX ULTRA IMPORTANT
* On clone toujours l'objet pour forcer React à re-render
* sinon l'écran abonnement peut rester bloqué
*/
setSubscription({
...res.data,
});

} catch (e) {
console.log("❌ subscription fetch error", e);
}
};

/* =====================================================
⚡ AUTO REFRESH AU LOGIN
===================================================== */

useEffect(() => {
refreshSubscription();
}, [token]);

/* =====================================================
🔥 REALTIME REFRESH — FINTECH UX
Quand l'utilisateur revient dans l'app
===================================================== */

useEffect(() => {

const sub = AppState.addEventListener("change", (state) => {
if (state === "active") {
refreshSubscription();
}
});

return () => sub.remove();

}, [token]);

/* =====================================================
PROVIDER
===================================================== */

return (
<SubscriptionContext.Provider
value={{
subscription,
refreshSubscription,
}}
>
{children}
</SubscriptionContext.Provider>
);
};

/* =====================================================
🔥 HOOK ULTRA SAFE
===================================================== */

export function useSubscription() {

const ctx = useContext(SubscriptionContext);

if (!ctx) {
throw new Error(
"useSubscription doit être utilisé à l'intérieur de SubscriptionProvider"
);
}

return ctx;
}
