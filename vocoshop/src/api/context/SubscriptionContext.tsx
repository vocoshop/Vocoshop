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
refreshSubscription: () => Promise<SubscriptionType | null>;
};

/* =====================================================
🧠 CONTEXT
===================================================== */

export const SubscriptionContext = createContext<SubscriptionContextType>({
subscription: null,
refreshSubscription: async (): Promise<SubscriptionType | null> => null,
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

  const refreshSubscription = async (): Promise<SubscriptionType | null> => {
    try {

      if (!token) {
        setSubscription(null);
        return null;
      }

      const res: any = await API.get("/subscription/me");

      if (!res?.data) {
        setSubscription(null);
        return null;
      }

      const data: SubscriptionType = {
        ...res.data,
      };
      setSubscription(data);
      return data;

    } catch (e) {
      console.log("❌ subscription fetch error", e);
      return null;
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
