import { useState, useMemo, useContext, useCallback } from "react";
import { Alert, Share, Platform } from "react-native";

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

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
  _id?: string;
  date: string;
  totalSales: number;
  totalRevenue: number;
  grossProfit?: number;
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

  const shareBilanPdf = useCallback(async (report: TodaySummary, userName: string) => {
    try {
      const employeeName = userName || "Employé";
      const itemsHtml = (report.sales || []).map((s) =>
        `<tr>
          <td style="padding:8px;border-bottom:1px solid #e0e0e0;color:#333;">${s.productName}</td>
          <td style="padding:8px;border-bottom:1px solid #e0e0e0;text-align:center;color:#333;">${s.quantity}</td>
          <td style="padding:8px;border-bottom:1px solid #e0e0e0;text-align:right;color:#333;">${Math.round(s.unitPrice).toLocaleString("fr-FR")} FCFA</td>
          <td style="padding:8px;border-bottom:1px solid #e0e0e0;text-align:right;color:#333;">${Math.round(s.totalAmount).toLocaleString("fr-FR")} FCFA</td>
        </tr>`
      ).join("");

      const grossProfit = report.grossProfit;
      const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: 'Helvetica Neue', Arial, sans-serif; margin: 0; padding: 24px; color: #222; }
    h1 { color: #1a1a2e; font-size: 22px; margin-bottom: 4px; }
    .date { color: #666; font-size: 13px; margin-bottom: 20px; }
    .summary { display: flex; gap: 16px; margin-bottom: 24px; }
    .card { flex: 1; background: #f4f4f9; padding: 14px; border-radius: 10px; text-align: center; }
    .card-label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 1px; }
    .card-value { font-size: 18px; font-weight: 700; color: #1a1a2e; margin-top: 4px; }
    .card-value.green { color: #22c55e; }
    table { width: 100%; border-collapse: collapse; margin-top: 8px; }
    th { padding: 8px; background: #1a1a2e; color: #fff; font-size: 12px; text-align: left; }
    th.right { text-align: right; }
    th.center { text-align: center; }
    .total-row td { font-weight: 700; padding: 10px 8px; border-top: 2px solid #1a1a2e; font-size: 14px; }
    .footer { margin-top: 32px; text-align: center; color: #aaa; font-size: 11px; }
  </style>
</head>
<body>
  <h1>Bilan Journalier</h1>
  <div class="date">${report.date || new Date().toISOString().split("T")[0]}</div>
  <div class="date" style="margin-top:-12px;color:#888;">Clôturé par : ${employeeName}</div>

  <div class="summary">
    <div class="card">
      <div class="card-label">Chiffre d'affaires</div>
      <div class="card-value">${Math.round(report.totalRevenue).toLocaleString("fr-FR")} FCFA</div>
    </div>
    <div class="card">
      <div class="card-label">Ventes</div>
      <div class="card-value">${report.totalSales}</div>
    </div>
    ${grossProfit != null ? `
    <div class="card">
      <div class="card-label">Bénéfice</div>
      <div class="card-value green">${Math.round(grossProfit).toLocaleString("fr-FR")} FCFA</div>
    </div>` : ""}
  </div>

  <table>
    <tr>
      <th>Produit</th>
      <th class="center">Qté</th>
      <th class="right">Prix unit.</th>
      <th class="right">Total</th>
    </tr>
    ${itemsHtml || "<tr><td colspan='4' style='text-align:center;padding:20px;color:#999;'>Aucun produit</td></tr>"}
    <tr class="total-row">
      <td colspan="3" style="text-align:right;">Total</td>
      <td style="text-align:right;">${Math.round(report.totalRevenue).toLocaleString("fr-FR")} FCFA</td>
    </tr>
  </table>

  <div class="footer">Généré par Vocoshop</div>
</body>
</html>`;

      const { uri } = await Print.printToFileAsync({ html, width: 595, height: 842 });
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(uri, {
          mimeType: "application/pdf",
          dialogTitle: "Partager le bilan journalier",
          UTI: "com.adobe.pdf",
        });
      }
    } catch (e) {
      console.log("❌ shareBilanPdf error:", e);
    }
  }, []);

  const shareBilanText = useCallback(async (report: TodaySummary) => {
    const rev = (report.totalRevenue ?? 0).toLocaleString("fr");
    const profit = (report.grossProfit ?? 0).toLocaleString("fr");
    const date = new Date(report.date).toLocaleDateString("fr");
    const ref = report._id ? report._id.slice(-6).toUpperCase() : "";

    const msg =
      `Bonjour,\n\n` +
      `Voici le bilan de votre boutique pour le ${date} :\n` +
      `💰 Chiffre d'affaires : ${rev} FCFA\n` +
      `🛒 Nombre de ventes : ${report.totalSales}\n` +
      `📈 Bénéfice net : ${profit} FCFA\n\n` +
      `Réf : ${ref}\n` +
      `Ce rapport est généré automatiquement par VocoShop et ne peut être modifié sur le serveur.\n\n` +
      `📲 Suivez toute votre activité en temps réel avec l'application VocoShop, disponible sur le Play Store.\n` +
      `👉 VocoShop : Vendez, Gérez, Grandissez.`;

    try {
      await Share.share({ message: msg });
    } catch (_) {}
  }, []);

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
      let res;
      try {
        res = await API.post<CloseDayResponse>(
          "/sales/close-day",
          {},
          { headers }
        );
      } catch {
        // Si la requête échoue (timeout, réseau instable), on queue
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
          "Synchronisation en attente ✅",
          "La clôture sera réessayée automatiquement."
        );

        return;
      }

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
        _id: (report as any)._id?.toString(),
        date: report.date ?? "",
        totalSales: Number(report.totalSales ?? 0),
        totalRevenue: Number(report.totalRevenue ?? 0),
        grossProfit: report.grossProfit,
        sales: Array.isArray(report.sales) ? report.sales : [],
      });

      // ✅ Partage du bilan
      const userRole = data?.userRole || "";
      if (userRole === "owner") {
        shareBilanText(report);
      } else {
        const userName = data?.userName || "";
        shareBilanPdf(report, userName);
      }

    } catch (err: any) {
      console.log("❌ closeDay error:", err?.response?.data || err);
      Alert.alert("Erreur", "Impossible de clôturer la journée.");
      setDayModal(false);
    } finally {
      setDayLoading(false);
    }
  }, [headers, shareBilanPdf, shareBilanText]);

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
