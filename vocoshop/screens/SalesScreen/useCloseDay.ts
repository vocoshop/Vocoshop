import { useState, useMemo, useContext, useCallback } from "react";
import { Alert } from "react-native";

import API from "../../src/api/api";
import { AuthContext } from "../../src/api/context/AuthContext";

import { runOrQueue } from "../../src/api/offline/queue";
import { isOffline } from "../../src/api/utils/network";

/* =====================================================
TYPES
===================================================== */
export interface TodaySaleItem {
productName: string;
quantity: number;
unitPrice: number;
totalAmount: number;
createdAt?: string;
}

export interface TodaySummary {
date: string;
totalSales: number;
totalRevenue: number;
sales: TodaySaleItem[];
}

type CloseDayResponse = { report: TodaySummary } | TodaySummary;

/* =====================================================
HOOK
===================================================== */
export default function useCloseDay() {
const { token, storeId } = useContext(AuthContext);

const headers = useMemo(
() => ({
Authorization: `Bearer ${token}`,
"x-store-id": storeId || "",
}),
[token, storeId]
);

/* ================= STATE ================= */
const [dayModal, setDayModal] = useState(false);
const [dayLoading, setDayLoading] = useState(false);
const [daySummary, setDaySummary] = useState<TodaySummary | null>(null);

/* =====================================================
CLOSE DAY — VERSION PRO STABLE
===================================================== */
const closeDay = useCallback(async () => {
setDayModal(true);
setDayLoading(true);
setDaySummary(null);

try {
/* =====================================================
🔴 OFFLINE MODE
===================================================== */
if (isOffline()) {
await runOrQueue({
title: "Clôture journée",
method: "POST",
url: "/sales/close-day",
body: {},
headers,
});

setDaySummary({
date: new Date().toISOString(),
totalSales: 0,
totalRevenue: 0,
sales: [],
});

Alert.alert(
"Mode hors-ligne ✅",
"La clôture sera synchronisée automatiquement dès le retour internet."
);

return;
}

/* =====================================================
🟢 ONLINE MODE
===================================================== */
const res = await API.post<CloseDayResponse>(
"/sales/close-day",
{},
{ headers }
);

const data: any = res.data;
const report: TodaySummary | undefined =
data?.report ?? data;

if (!report) {
setDaySummary({
date: "",
totalSales: 0,
totalRevenue: 0,
sales: [],
});
return;
}

setDaySummary({
date: report.date ?? "",
totalSales: Number(report.totalSales ?? 0),
totalRevenue: Number(report.totalRevenue ?? 0),
sales: Array.isArray(report.sales) ? report.sales : [],
});

} catch (err: any) {
console.log("❌ closeDay error:", err?.response?.data || err);
Alert.alert("Erreur", "Impossible de clôturer la journée.");
setDayModal(false);
} finally {
setDayLoading(false);
}
}, [headers]);

/* =====================================================
RETURN
===================================================== */
return {
dayModal,
dayLoading,
daySummary,
closeDay,
setDayModal,
};
}
