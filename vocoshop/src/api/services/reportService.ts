import API from "../api";

/* =====================================================
TYPES
===================================================== */
export type ReportKpis = {
totalProducts: number;
totalQuantity: number;
totalStockValue: number;
estimatedResellValue: number; // ✅ valeur estimée de la boutique
totalPotentialProfit: number; // (pour plus tard, profil → analyser ma boutique)
};

/* =====================================================
API CALLS
===================================================== */
export const getReportKpis = async (headers: any): Promise<ReportKpis> => {
const res = await API.get<ReportKpis>("/report/kpis", {
headers,
});

return res.data;
};
