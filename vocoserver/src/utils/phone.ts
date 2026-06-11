/**
 * Normalise un numéro de téléphone en format E.164.
 * - retire espaces/tirets/parenthèses
 * - 00xxxx → +xxxx
 * - 0xxxx → +242xxxx (par défaut Congo)
 * - xxxxx → +242xxxxx (par défaut Congo)
 */
export function normalizePhone(raw: any, defaultCountryCode = "242"): string {
  const s = String(raw || "").trim();
  if (!s) return "";

  let p = s.replace(/[^\d+]/g, "");

  if (p.startsWith("00")) p = "+" + p.slice(2);
  if (p.startsWith("+")) return p;

  if (p.startsWith("0")) return `+${defaultCountryCode}${p.slice(1)}`;
  return `+${defaultCountryCode}${p}`;
}
