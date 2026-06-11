/**
* 🔥 OPERATOR DETECTOR AFRICA READY
* Reconnaît automatiquement l'opérateur mobile money
*/

export type MobileOperator =
| "MTN"
| "AIRTEL"
| "ORANGE"
| "UNKNOWN";

export function detectOperator(phone: string): MobileOperator {

if (!phone) return "UNKNOWN";

// 🔥 on nettoie le numéro
const clean = phone.replace(/\s+/g, "");

/* =====================================================
🇨🇬 CONGO BRAZZAVILLE EXEMPLE
===================================================== */

// MTN : 06
if (clean.startsWith("+24206") || clean.startsWith("06")) {
return "MTN";
}

// Airtel : 05
if (clean.startsWith("+24205") || clean.startsWith("05")) {
return "AIRTEL";
}

// Orange (exemple futur)
if (clean.startsWith("+24207") || clean.startsWith("07")) {
return "ORANGE";
}

/* =====================================================
🔥 SCALE AFRIQUE (tu ajouteras ici plus tard)
===================================================== */

return "UNKNOWN";
}
