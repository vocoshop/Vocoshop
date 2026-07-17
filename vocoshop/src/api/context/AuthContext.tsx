// src/api/context/AuthContext.tsx

import React, {
createContext,
useState,
useEffect,
useMemo,
useCallback,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import * as Application from "expo-application";
import Constants from "expo-constants";
import NetInfo, { NetInfoState } from "@react-native-community/netinfo";

import API from "../api";

/* =====================================================
TYPES
===================================================== */
interface LoginResponse {
token: string;
storeId: string;
user: any;
storeType?: string;
isOnboarded?: boolean;
otpSkipped?: boolean;
}

type ApplySessionPayload = {
token: string;
storeId: string;
user?: any;
storeType?: string | null;
isOnboarded?: boolean;
};

type VerifyOtpOptions = {
forceRelink?: boolean;
};

type DeviceLoginResult =
| { ok: true }
| { ok: false; reason: "OTP_REQUIRED" | "NO_ACCOUNT" | "UNKNOWN" };

type StoreInfo = {
_id: string;
storeName: string;
phone: string;
city: string;
hasPassword: boolean;
};

type CheckPhoneResult = {
exists: boolean;
hasPassword?: boolean;
phoneVerified?: boolean;
subscriptionActive?: boolean;
multipleStores?: boolean;
stores?: StoreInfo[];
};

type LoginResponseData = {
  message: string;
  storeId: string;
  token: string;
  isOnboarded: boolean;
  phoneVerified: boolean;
  subscriptionActive: boolean;
  recoveryCode?: string;
};

interface AuthContextType {
user: any;
token: string | null;
storeId: string | null;
loading: boolean;
isReady: boolean;

isOnline: boolean;
isOfflineReady: boolean;

requestOTP: (phone: string) => Promise<boolean>;
verifyOTP: (
phone: string,
code: string,
options?: VerifyOtpOptions
) => Promise<boolean>;

deviceLogin: (phone: string) => Promise<DeviceLoginResult>;

checkPhone: (phone: string) => Promise<CheckPhoneResult>;
tryAutoLogin: () => Promise<LoginResponseData | null>;
loginWithPassword: (phone: string, password: string) => Promise<LoginResponseData>;
registerWithPassword: (phone: string, password: string, storeName?: string, ownerName?: string, ownerPhone?: string, referralCodeUsed?: string) => Promise<LoginResponseData>;

logout: () => Promise<void>;

getAuthHeaders: () => Record<string, string>;
applySession: (payload: ApplySessionPayload) => Promise<void>;

refreshUser: () => Promise<void>;

inventoryActive: boolean;
setInventoryActive: (v: boolean) => void;

inventoryCount: number;
setInventoryCount: React.Dispatch<React.SetStateAction<number>>;

inventorySessionId: string | null;
setInventorySessionId: (v: string | null) => void;

storeType: string | null;
setStoreType: (t: string | null) => void;
}

export const AuthContext = createContext<AuthContextType>(
{} as AuthContextType
);

/* =====================================================
DEVICE ID
===================================================== */
const DEVICE_ID_KEY = "voco_device_id_v1";
const NET_LAST_ONLINE_KEY = "voco_net_last_online_v1";

function makePseudoId() {
return `dev_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

async function getStableDeviceId(): Promise<string> {
const existing = await AsyncStorage.getItem(DEVICE_ID_KEY);
if (existing && existing.trim()) return existing.trim();

let id = "";

try {
const fn = (Application as any)?.getIosIdForVendorAsync;
if (Platform.OS === "ios" && typeof fn === "function") {
const v = await fn();
id = String(v || "").trim();
}
} catch {}

if (!id && Platform.OS === "android") {
try {
const a = (Application as any)?.androidId;
id = String(a || "").trim();
} catch {}
}

if (!id) {
try {
const c = (Constants as any)?.installationId;
id = String(c || "").trim();
} catch {}
}

if (!id) id = makePseudoId();

await AsyncStorage.setItem(DEVICE_ID_KEY, id);
return id;
}

/* =====================================================
PROVIDER
===================================================== */
export const AuthProvider = ({ children }: any) => {
const [user, setUser] = useState<any>(null);
const [token, setToken] = useState<string | null>(null);
const [storeId, setStoreId] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

const [inventoryActive, setInventoryActive] = useState(false);
const [inventoryCount, setInventoryCount] = useState(0);
const [inventorySessionId, setInventorySessionId] = useState<string | null>(
null
);
const [storeType, setStoreType] = useState<string | null>(null);

const [isOnline, setIsOnline] = useState(true);
const [isOfflineReady, setIsOfflineReady] = useState(false);

const isReady = useMemo(() => !loading, [loading]);

/* =====================================================
REFRESH USER
===================================================== */
const refreshUser = useCallback(async () => {
try {
const res = await API.get("/store/me/user");
const data = res.data;
if (data) {
setUser(data);
await AsyncStorage.setItem("user", JSON.stringify(data));
}
    } catch {} // les permissions en cache restent valables
}, []);

const getAuthHeaders = useCallback(() => {
const base: Record<string, string> = {
Authorization: token ? `Bearer ${token}` : "",
};
if (storeId) base["x-store-id"] = storeId;
return base;
}, [token, storeId]);

/* =====================================================
APPLY SESSION
===================================================== */
const applySession = useCallback(async (p: ApplySessionPayload) => {
const tk = String(p.token || "");
const st = String(p.storeId || "");
const stType = p.storeType ?? null;

if (!tk || !st) throw new Error("applySession: token/storeId manquant");

setToken(tk);
setStoreId(st);
if (p.user !== undefined) setUser(p.user);
if (stType !== null) setStoreType(stType);

await AsyncStorage.setItem("token", tk);
await AsyncStorage.setItem("storeId", st);
if (stType) await AsyncStorage.setItem("storeType", String(stType));

// ✅ Sauvegarder le user (permissions, role, etc.)
if (p.user !== undefined) {
  await AsyncStorage.setItem("user", JSON.stringify(p.user));
}

if (typeof p.isOnboarded === "boolean") {
  await AsyncStorage.setItem(
    "isOnboarded",
    p.isOnboarded ? "true" : "false"
  );
}
}, []);

/* =====================================================
OFFLINE LISTENER
===================================================== */
useEffect(() => {
let unsub: any = null;
let mounted = true;

const normalizeOnline = (state: NetInfoState) => {
const connected = state.isConnected === true;
const reachable =
state.isInternetReachable == null
? true
: state.isInternetReachable === true;
return connected && reachable;
};

(async () => {
const saved = await AsyncStorage.getItem(NET_LAST_ONLINE_KEY);
if (mounted && (saved === "0" || saved === "1")) {
setIsOnline(saved === "1");
}

const current = await NetInfo.fetch();
const onlineNow = normalizeOnline(current);

if (mounted) {
setIsOnline(onlineNow);
setIsOfflineReady(true);
}

await AsyncStorage.setItem(
NET_LAST_ONLINE_KEY,
onlineNow ? "1" : "0"
);

unsub = NetInfo.addEventListener(async (state) => {
const online = normalizeOnline(state);
setIsOnline(online);
setIsOfflineReady(true);
await AsyncStorage.setItem(
NET_LAST_ONLINE_KEY,
online ? "1" : "0"
);
});
})();

return () => {
mounted = false;
if (typeof unsub === "function") unsub();
};
}, []);

/* =====================================================
BOOT SESSION
===================================================== */
useEffect(() => {
const load = async () => {
try {
const [tk, st, invA, invC, stType, invSession, userStr] = await Promise.all([
AsyncStorage.getItem("token"),
AsyncStorage.getItem("storeId"),
AsyncStorage.getItem("inventoryActive"),
AsyncStorage.getItem("inventoryCount"),
AsyncStorage.getItem("storeType"),
AsyncStorage.getItem("inventorySessionId"),
AsyncStorage.getItem("user"),
]);

const finalToken = tk || null;

setToken(finalToken);
setStoreId(st);

if (invA !== null) setInventoryActive(JSON.parse(invA));
if (invC !== null) setInventoryCount(parseInt(invC, 10) || 0);
if (stType !== null) setStoreType(stType);
if (invSession !== null) setInventorySessionId(invSession);

// ✅ Restaurer le user (permissions, role, etc.)
if (userStr !== null) {
  try {
    const userObj = JSON.parse(userStr);
    setUser(userObj);
  } catch (e) {
    console.log("⚠️ Erreur parsing user from AsyncStorage:", e);
  }
}
} finally {
setLoading(false);
}
};

load();
}, []);

/* =====================================================
CHECK PHONE
===================================================== */
const checkPhone = async (phone: string): Promise<CheckPhoneResult> => {
const res = await API.post<CheckPhoneResult>("/auth/check-phone", { phone });
return res.data;
};

const tryAutoLogin = async (): Promise<LoginResponseData | null> => {
  try {
    const deviceId = await getStableDeviceId();
    const res = await API.post<LoginResponseData>("/auth/auto-login", { deviceId });
    await applySession({
      token: res.data.token,
      storeId: res.data.storeId,
      isOnboarded: res.data.isOnboarded,
    });
    return res.data;
  } catch {
    return null;
  }
};

const loginWithPassword = async (phone: string, password: string) => {
const deviceId = await getStableDeviceId();
const res = await API.post<LoginResponseData>("/auth/login", { phone, password, deviceId });
await applySession({
token: res.data.token,
storeId: res.data.storeId,
isOnboarded: res.data.isOnboarded,
});
return res.data;
};

const registerWithPassword = async (phone: string, password: string, storeName?: string, ownerName?: string, ownerPhone?: string, referralCodeUsed?: string) => {
const deviceId = await getStableDeviceId();
const res = await API.post<LoginResponseData>("/auth/register", { phone, password, storeName, ownerName, ownerPhone, referralCodeUsed, deviceId });
await applySession({
token: res.data.token,
storeId: res.data.storeId,
isOnboarded: res.data.isOnboarded,
});
return res.data;
};

/* =====================================================
OTP
===================================================== */
const requestOTP = async (phone: string) => {
  try {
    await API.post("/otp/send", { phone });
    return true;
  } catch (e: any) {
    const status = e?.response?.status;
    if (!status) {
      console.log("OTP request error: Pas de connexion au serveur");
    } else {
      console.log("OTP request error:", e?.response?.data || e?.message || e);
    }
    return false;
  }
};

const verifyOTP = async (
phone: string,
code: string,
options?: VerifyOtpOptions
) => {
try {
const deviceId = await getStableDeviceId();

const payload: any = { phone, code, deviceId };
if (options?.forceRelink === true) payload.forceRelink = true;

const res = await API.post<LoginResponse>("/otp/verify", payload);

await applySession({
token: res.data.token,
storeId: res.data.storeId,
user: res.data.user,
storeType: res.data.storeType ?? null,
isOnboarded:
typeof res.data.isOnboarded === "boolean"
? res.data.isOnboarded
: undefined,
});

return true;
} catch (e: any) {
const data = e?.response?.data;
if (data?.code === "DEVICE_LOCKED") throw e;
console.log("OTP verify error:", data || e?.message || e);
return false;
}
};

const deviceLogin = async (
phone: string
): Promise<DeviceLoginResult> => {
try {
const deviceId = await getStableDeviceId();

const res = await API.post<LoginResponse>("/otp/device-login", {
phone,
deviceId,
});

await applySession({
token: res.data.token,
storeId: res.data.storeId,
user: res.data.user,
storeType: res.data.storeType ?? null,
isOnboarded:
typeof res.data.isOnboarded === "boolean"
? res.data.isOnboarded
: undefined,
});

return { ok: true };
} catch (e: any) {
const status = e?.response?.status;
const data = e?.response?.data;

if (data?.code === "DEVICE_LOCKED") throw e;
if (data?.code === "REAUTH_REQUIRED")
return { ok: false, reason: "OTP_REQUIRED" };
if (status === 404 || data?.code === "STORE_NOT_FOUND")
return { ok: false, reason: "NO_ACCOUNT" };

return { ok: false, reason: "UNKNOWN" };
}
};

/* =====================================================
LOGOUT
===================================================== */
const logout = async () => {
await Promise.all([
AsyncStorage.removeItem("token"),
AsyncStorage.removeItem("storeId"),
AsyncStorage.removeItem("inventoryActive"),
AsyncStorage.removeItem("inventoryCount"),
AsyncStorage.removeItem("storeType"),
AsyncStorage.removeItem("inventorySessionId"),
AsyncStorage.removeItem("isOnboarded"),
AsyncStorage.removeItem("user"),
]);

setToken(null);
setStoreId(null);
setUser(null);
setInventoryActive(false);
setInventoryCount(0);
setStoreType(null);
setInventorySessionId(null);
};

return (
<AuthContext.Provider
value={{
user,
token,
storeId,
loading,
isReady,

isOnline,
isOfflineReady,

getAuthHeaders,
refreshUser,
requestOTP,
verifyOTP,
deviceLogin,
checkPhone,
tryAutoLogin,
loginWithPassword,
registerWithPassword,
logout,
applySession,

inventoryActive,
setInventoryActive,
inventoryCount,
setInventoryCount,
inventorySessionId,
setInventorySessionId,
storeType,
setStoreType,
}}
>
{children}
</AuthContext.Provider>
);
};
