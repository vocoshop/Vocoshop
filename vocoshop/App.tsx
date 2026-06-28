// App.tsx

import React, { useEffect, useState, useContext, useCallback } from "react";
import { View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { NavigationContainer, useFocusEffect } from "@react-navigation/native";
import { createStackNavigator } from "@react-navigation/stack";
import AsyncStorage from "@react-native-async-storage/async-storage";


// ✅ API instance (pour baseURL)
import API from "./src/api/api";

// ✅ OFFLINE: network listener + force offline (DEV)
import {
setForceOffline,
} from "./src/api/utils/network";

import { initOfflineBootstrap } from "./src/api/offline/bootstrap";

// 🔗 Deep linking
import { linking } from "./src/api/navigation/linking";
import { navigationRef } from "./src/api/navigation/navigationRef";

// AUTH
import LoginScreen from "./screens/LoginScreen";
import HomeScreen from "./screens/HomeScreen";

// PROFIL / ONBOARDING
import OnboardingScreen from "./screens/OnboardingScreen";

// 🔗 INVITATION EMPLOYÉ (DEEPLINK)
import InviteScreen from "./screens/InviteScreen";

// INVENTAIRE
import InventoryScreen from "./screens/InventoryScreen";
import AddProductScreen from "./screens/AddProductScreen";
import InventoryDetailScreen from "./screens/InventoryDetailScreen";

// STOCK
import StockScreen from "./screens/StockScreen";
import AddStockScreen from "./screens/AddStockScreen";
import StockProductDetailsScreen from "./screens/StockProductDetailsScreen";
import CreateProductScreen from "./screens/CreateProductScreen";

// RETRAIT STOCK
import RemoveStockScreen from "./screens/RemoveStockScreen";
import StockRemoveDetailsScreen from "./screens/StockRemoveDetailsScreen";

// HISTORIQUE
import HistoryScreen from "./screens/HistoryScreen";
import NotificationsScreen from "./screens/NotificationsScreen";

// PROFIL
import ProfileScreen from "./screens/ProfileScreen";
import FundingScreen from "./screens/FundingScreen";
import GestionPartenaires from "./screens/admin/GestionPartenaires";
import PersonalInfoScreen from "./screens/PersonalInfoScreen";
import SubscriptionBlockedScreen from "./screens/SubscriptionBlockedScreen";
import SubscriptionScreen from "./screens/SubscriptionScreen";
import SubscriptionPayScreen from "./screens/SubscriptionPayScreen";
import SubscriptionCheckoutScreen from "./screens/SubscriptionCheckoutScreen";
import YabetooWebViewScreen from "./screens/YabetooWebViewScreen";
import { NotificationProvider } from "./src/api/context/NotificationContext";

// 🧑‍💼 MON AGENT
import MyAgentScreen from "./screens/MyAgentScreen";

// INVENTAIRES EMPLOYÉS
import InventorySessionsScreen from "./screens/InventorySessionsScreen";
import InventorySessionDetailScreen from "./screens/InventorySessionDetailScreen";
import InventoryAnalysisScreen from "./screens/InventoryAnalysisScreen";
import StockHistoryScreen from "./screens/StockHistoryScreen";
import FinishInventoryScreen from "./screens/FinishInventoryScreen";
import AppliedInventoryDetailScreen from "./screens/AppliedInventoryDetailScreen";

// REPORTS
import ReportScreen from "./screens/ReportScreen";
import ReportDetailScreen from "./screens/ReportDetailScreen";
import MyReportsScreen from "./screens/MyReportsScreen";

// AUTRES
import InventoryImpactScreen from "./screens/InventoryImpactScreen";
import SalesScreen from "./screens/SalesScreen";

// 📄 OCR
import OcrScanScreen from "./screens/OcrScanScreen";
import OcrValidationScreen from "./screens/OcrValidationScreen";

// 📸 PHOTO STOCK
import PhotoStockScreen from "./screens/PhotoStockScreen";

// COMMANDES
import CommanderScreen from "./screens/CommanderScreen";
import OrdersScreen from "./screens/OrdersScreen";
import CreateOrderScreen from "./screens/CreateOrderScreen";
import EditOrderScreen from "./screens/EditOrderScreen";
import OrderHistoryScreen from "./screens/OrderHistoryScreen";
import OrderDetailScreen from "./screens/OrderDetailScreen";

// FOURNISSEURS
import SuppliersScreen from "./screens/SuppliersScreen";
import MesFournisseursScreen from "./screens/MesFournisseursScreen";
import SupplierDetailScreen from "./screens/SupplierDetailScreen";
import EditSupplierScreen from "./screens/EditSupplierScreen";
import SupplierProductsScreen from "./screens/SupplierProductsScreen";

// SANTÉ STOCK
import HealthStockScreen from "./screens/HealthStockScreen";

// MA BOUTIQUE
import MyShopScreen from "./screens/MyShopScreen";
import ManageShopScreen from "./screens/ManageShopScreen";
import OfflineBanner from "./src/api/components/OfflineBanner";
import SyncIndicator from "./src/api/components/SyncIndicator";
import SplashScreen from "./screens/SplashScreen";
import InvoiceListScreen from "./screens/invoiceListScreen";
import InvoiceDetailScreen from "./screens/InvoiceDetailScreen";

// EMPLOYÉS
import EmployeesScreen from "./screens/EmployeesScreen";
import CreateEmployeeScreen from "./screens/CreateEmployeeScreen";
import EditEmployeeScreen from "./screens/EditEmployeeScreen";

// CONTEXT
import { AuthProvider, AuthContext } from "./src/api/context/AuthContext";
import { SubscriptionProvider } from "./src/api/context/SubscriptionContext";
import { LanguageProvider } from "./src/api/context/LanguageContext";

import { initSyncEngine } from "./src/api/offline/syncEngine";
import { initOcrSyncEngine } from "./src/api/ocr/ocrOfflineQueue";

const Stack = createStackNavigator();

/**
* EntryGate ULTRA BÉTON (fix loop onboarding):
* - relit token/isOnboarded À CHAQUE FOCUS sur Entry
* - fallback serveur /store/me si isOnboarded local false
*/
function EntryGate({ navigation }: any) {
const { token, loading } = useContext(AuthContext);

const [bootLoading, setBootLoading] = useState(true);
const [bootToken, setBootToken] = useState<string | null>(null);
const [onboarded, setOnboarded] = useState<boolean>(false);

const readLocalFlags = useCallback(async () => {
const [tk, onb] = await Promise.all([
AsyncStorage.getItem("token"),
AsyncStorage.getItem("isOnboarded"),
]);
setBootToken(tk);
setOnboarded(onb === "true");
}, []);

// ✅ 1) premier boot

useEffect(() => {
let mounted = true;

const boot = async () => {
try {
await readLocalFlags();
} catch {}

if (mounted) {
setBootLoading(false); // ✅ IMPORTANT — débloque EntryGate
}
};

boot();

return () => {
mounted = false;
};
}, []);

// ✅ 2) relire à chaque retour sur Entry (FIX LOOP)
useFocusEffect(
useCallback(() => {
readLocalFlags().catch(() => {});
return () => {};
}, [readLocalFlags])
);

// ✅ 3) Décision finale + fallback serveur
useEffect(() => {
let cancelled = false;

const decide = async () => {
if (loading || bootLoading) return;

const effectiveToken = token || bootToken;

if (!effectiveToken) {
navigation.reset({ index: 0, routes: [{ name: "Login" }] });
return;
}

if (onboarded) {
navigation.reset({ index: 0, routes: [{ name: "Home" }] });
return;
}

try {
const baseUrl = (API as any)?.defaults?.baseURL || "";
if (!baseUrl) throw new Error("API.baseURL manquant");

const res = await fetch(`${baseUrl}/store/me`, {
method: "GET",
headers: { Authorization: `Bearer ${effectiveToken}` },
});

if (cancelled) return;

if (res.ok) {
const profile = await res.json();
const serverOnboarded = Boolean(profile?.isOnboarded);

if (serverOnboarded) {
await AsyncStorage.setItem("isOnboarded", "true");
if (cancelled) return;

setOnboarded(true);
navigation.reset({ index: 0, routes: [{ name: "Home" }] });
return;
}
} else {
// Token invalide (401/404) → nettoyer et rediriger Login
await AsyncStorage.multiRemove(["token", "storeId", "isOnboarded"]);
if (cancelled) return;
navigation.reset({ index: 0, routes: [{ name: "Login" }] });
return;
}
} catch {
// Token invalide ou serveur injoignable → nettoyer et rediriger vers Login
await AsyncStorage.multiRemove(["token", "isOnboarded"]);
if (cancelled) return;
navigation.reset({ index: 0, routes: [{ name: "Login" }] });
return;
}

// isOnboarded === false → Onboarding
navigation.reset({ index: 0, routes: [{ name: "Onboarding" }] });
};

decide();

return () => {
cancelled = true;
};
}, [loading, bootLoading, token, bootToken, onboarded, navigation]);

return (
    <View style={{ flex: 1, backgroundColor: "#070014" }} />
  );
}

export default function App() {

const [showSplash, setShowSplash] = useState(true);
const [bootReady, setBootReady] = useState(false);

/**
 * ✅ OFFLINE — Bootstrap offline (UNE SEULE FOIS)
 * (inclut le network listener global)
 */
useEffect(() => {
const stop = initOfflineBootstrap();
return () => stop?.();
}, []);

/**
* 🧪 DEV TEST (optionnel) : force offline 10 secondes au boot
*/
useEffect(() => {
const DEV_FORCE_OFFLINE = false;

if (!DEV_FORCE_OFFLINE) return;

setForceOffline(true);

const t = setTimeout(() => {
setForceOffline(null);
}, 10000);

return () => clearTimeout(t);
}, []);

// ✅ Boot async (init engines + read token/onboarded) pendant le splash
useEffect(() => {
let mounted = true;
(async () => {
  initSyncEngine();
  initOcrSyncEngine();
  if (mounted) setBootReady(true);
})();
return () => { mounted = false; };
}, []);

/**
 * ✅ 3 — APP NORMALE
 */
if (showSplash) {
return <SplashScreen onFinish={() => setShowSplash(false)} />;
}

return (
<LanguageProvider>
<AuthProvider>

{/* 🔥 PROVIDER ABONNEMENT */}
<SubscriptionProvider>

<NotificationProvider>

{/* ✅ UN SEUL NavigationContainer */}
<NavigationContainer ref={navigationRef} linking={linking}>

<StatusBar style="light" />

<Stack.Navigator
initialRouteName="Entry"
screenOptions={{
headerShown:false,
animation:"slide_from_right",
}}
>

{/* ✅ ROUTEUR */}
<Stack.Screen name="Entry" component={EntryGate} />

{/* 🔐 AUTH */}
<Stack.Screen name="Login" component={LoginScreen} />

{/* 🧩 ONBOARDING */}
<Stack.Screen name="Onboarding" component={OnboardingScreen} />

<Stack.Screen
name="SubscriptionBlocked"
component={SubscriptionBlockedScreen}
/>

{/* 🏠 HOME */}
<Stack.Screen name="Home" component={HomeScreen} />

{/* 🔗 INVITATION EMPLOYÉ */}
<Stack.Screen name="Invite" component={InviteScreen} />

{/* 🧾 COMMANDES */}
<Stack.Screen name="Commander" component={CommanderScreen} />
<Stack.Screen name="Orders" component={OrdersScreen} />
<Stack.Screen name="CreateOrder" component={CreateOrderScreen} />
<Stack.Screen name="EditOrder" component={EditOrderScreen} />
<Stack.Screen name="OrderHistory" component={OrderHistoryScreen} />
<Stack.Screen name="OrderDetail" component={OrderDetailScreen} />

{/* 🏭 FOURNISSEURS */}
<Stack.Screen name="MesFournisseurs" component={MesFournisseursScreen} />
<Stack.Screen name="Suppliers" component={SuppliersScreen} />
<Stack.Screen name="SupplierDetail" component={SupplierDetailScreen} />
<Stack.Screen name="EditSupplier" component={EditSupplierScreen} />
<Stack.Screen name="SupplierProducts" component={SupplierProductsScreen} />

{/* 📊 REPORTS */}
<Stack.Screen name="Report" component={ReportScreen} />
<Stack.Screen name="ReportDetail" component={ReportDetailScreen} />
<Stack.Screen name="MyReports" component={MyReportsScreen} />

{/* 📦 INVENTAIRE */}
<Stack.Screen name="Inventory" component={InventoryScreen} />
<Stack.Screen name="AddProduct" component={AddProductScreen} />
<Stack.Screen name="InventoryDetails" component={InventoryDetailScreen} />
<Stack.Screen name="AppliedInventoryDetail" component={AppliedInventoryDetailScreen} />

{/* 📦 STOCK */}
<Stack.Screen name="Stock" component={StockScreen} />
<Stack.Screen name="AddStock" component={AddStockScreen} />
<Stack.Screen name="StockProductDetails" component={StockProductDetailsScreen} />
<Stack.Screen name="CreateProduct" component={CreateProductScreen} />
{/* ➖ RETRAIT STOCK */}
<Stack.Screen name="RemoveStock" component={RemoveStockScreen} />
<Stack.Screen name="StockRemoveDetails" component={StockRemoveDetailsScreen} />

{/* 🕘 HISTORIQUE */}
<Stack.Screen name="History" component={HistoryScreen} />
<Stack.Screen name="StockHistory" component={StockHistoryScreen} />

{/* 👤 PROFIL */}
<Stack.Screen name="Profile" component={ProfileScreen} />
<Stack.Screen name="Funding" component={FundingScreen} />
<Stack.Screen name="GestionPartenaires" component={GestionPartenaires} />
<Stack.Screen name="MyAgent" component={MyAgentScreen} />
<Stack.Screen name="Notifications" component={NotificationsScreen} />
<Stack.Screen name="PersonalInfo" component={PersonalInfoScreen} />
<Stack.Screen name="InvoiceList" component={InvoiceListScreen} />
<Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />

{/* 🏪 MA BOUTIQUE */}
<Stack.Screen name="MyShop" component={MyShopScreen} />
<Stack.Screen name="ManageShop" component={ManageShopScreen} />
<Stack.Screen name="Subscription" component={SubscriptionScreen} />
<Stack.Screen name="SubscriptionPay" component={SubscriptionPayScreen} />
<Stack.Screen name="SubscriptionCheckout" component={SubscriptionCheckoutScreen} />
<Stack.Screen name="YabetooWebView" component={YabetooWebViewScreen} />

{/* 👥 EMPLOYÉS */}
<Stack.Screen name="Employees" component={EmployeesScreen} />
<Stack.Screen name="EmployeeCreate" component={CreateEmployeeScreen} />
<Stack.Screen name="EmployeeEdit" component={EditEmployeeScreen} />

{/* 📋 INVENTAIRES EMPLOYÉS */}
<Stack.Screen name="InventorySessions" component={InventorySessionsScreen} />
<Stack.Screen name="InventoryAnalysis" component={InventoryAnalysisScreen} />
<Stack.Screen name="InventorySessionDetail" component={InventorySessionDetailScreen} />
<Stack.Screen name="FinishInventory" component={FinishInventoryScreen} />

{/* 📈 ANALYSES */}
<Stack.Screen name="InventoryImpact" component={InventoryImpactScreen} />

{/* ❤️ SANTÉ STOCK */}
<Stack.Screen name="StockHealth" component={HealthStockScreen} />

{/* 💰 VENTES */}
<Stack.Screen name="Sales" component={SalesScreen} />

{/* 📄 OCR */}
<Stack.Screen name="OcrScan" component={OcrScanScreen} />
<Stack.Screen name="OcrValidation" component={OcrValidationScreen} />

{/* 📸 PHOTO STOCK */}
<Stack.Screen name="PhotoStock" component={PhotoStockScreen} />

</Stack.Navigator>

{/* 🔥 GLOBAL UI */}
<SyncIndicator />

</NavigationContainer>

</NotificationProvider>
</SubscriptionProvider>
</AuthProvider>
</LanguageProvider>

);
}
