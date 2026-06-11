// src/api/services/storeService.ts
import API from "../api";
import type {
StoreProfile,
StoreKpis,
StoreOnboardingPayload,
} from "../types/store";

type ApiHeaders = Record<string, string>;

/* =====================================================
👤 Profil boutique
GET /api/store/me
===================================================== */
export const getMyStoreProfile = async (
headers: ApiHeaders
): Promise<StoreProfile> => {
const res = await API.get<StoreProfile>("/store/me", { headers });
return res.data;
};

/* =====================================================
📊 KPIs boutique
GET /api/store/kpis
===================================================== */
export const getStoreKpis = async (
headers: ApiHeaders
): Promise<StoreKpis> => {
const res = await API.get<StoreKpis>("/store/kpis", { headers });
return res.data;
};

/* =====================================================
🚀 Onboarding boutique
PATCH /api/store/onboarding
Body: { storeName, city?, agentCode? }
===================================================== */
export const updateStoreOnboarding = async (
payload: StoreOnboardingPayload,
headers: ApiHeaders
): Promise<StoreProfile> => {
const res = await API.patch<StoreProfile>(
"/store/onboarding",
payload,
{ headers }
);
return res.data;
};

/* =====================================================
🏪 Analyse boutique (endpoint unique)
GET /api/store/analysis?from=YYYY-MM-DD&to=YYYY-MM-DD
===================================================== */
export type StoreAnalysisQuery = { from?: string; to?: string };

export const getStoreAnalysis = async <T = any>(
headers: ApiHeaders,
params?: StoreAnalysisQuery
): Promise<T> => {
const res = await API.get<T>("/store/analysis", { headers, params });
return res.data;
};

// Compat anciennes routes
export const getStoreAnalysisDay = async <T = any>(
headers: ApiHeaders
): Promise<T> => {
return getStoreAnalysis<T>(headers);
};

export const getStoreAnalysisPeriod = async <T = any>(
params: { from: string; to: string },
headers: ApiHeaders
): Promise<T> => {
return getStoreAnalysis<T>(headers, params);
};

/* =====================================================
🧑‍💼 Mon agent (PROXY + NUM MASQUÉ)
GET /api/store/my-agent
===================================================== */

export type MyAgent = {
name: string;
code: string;
photoUrl?: string | null;
isActive: boolean;

// 🔐 Protection du vrai numéro
displayPhone: string; // affichage masqué
contactPhone: string; // numéro proxy Vocoshop (appel / whatsapp / sms)
};

export type MyAgentResponse = {
agent: MyAgent | null;
};

// Compat backend :
// - { agent: MyAgent | null }
// - MyAgent direct
// - null
type MyAgentApiRaw = MyAgentResponse | MyAgent | null;

export const getMyAgent = async (
headers: ApiHeaders
): Promise<MyAgentResponse> => {
const res = await API.get<MyAgentApiRaw>("/store/my-agent", { headers });
const data: any = res.data;

// ✅ Format A : { agent: MyAgent | null }
if (data && typeof data === "object" && "agent" in data) {
return { agent: data.agent ?? null };
}

// ✅ Format B : MyAgent direct
if (
data &&
typeof data === "object" &&
typeof data.name === "string" &&
typeof data.code === "string"
) {
return { agent: data as MyAgent };
}

// ❌ Fallback sécurisé
return { agent: null };
};

/* =====================================================
📞 Appel sécurisé via Vocoshop
POST /api/call-proxy/initiate
===================================================== */
export const initiateCallProxy = async (
headers: ApiHeaders,
agentCode: string
): Promise<{ message: string; proxyId: string }> => {
const res = await API.post<{ message: string; proxyId: string }>(
"/call-proxy/initiate",
{ agentCode },
{ headers }
);
return res.data;
};
