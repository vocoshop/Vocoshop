// src/api/types/store.ts

export interface StoreProfile {
shopName: string;
phone: string;
shopId: string;
plan: string;
referralCode: string;
referredCount: number;
paidReferrals: number;

// ✅ nouveaux champs onboarding
city?: string;
agentCode?: string;

// ✅ propriétaire
ownerName?: string;
ownerPhone?: string;

// ✅ très important pour décider si on affiche OnboardingScreen
isOnboarded?: boolean;
}

export interface StoreKpis {
totalProducts: number; // nb produits
totalStockQty: number; // somme des quantités
stockValueSell: number; // valeur estimée boutique (sellPrice * qty)
lowStockCount: number; // nb produits en stock faible
expiringCount: number; // nb produits bientôt expirés
}

// ✅ payload utilisé par PATCH /api/store/onboarding
export interface StoreOnboardingPayload {
storeName: string;
city?: string;
agentCode?: string;
ownerName?: string;
ownerPhone?: string;
}
