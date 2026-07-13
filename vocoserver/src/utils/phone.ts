/**
 * Normalise un numéro de téléphone en format E.164.
 * - retire espaces/tirets/parenthèses
 * - 00xxxx → +xxxx
 * - 0xxxx → +242xxxx (par défaut Congo)
 * - +2420xxxx → +242xxxx (retire le 0 après le code pays)
 * - xxxxx → +242xxxxx (par défaut Congo)
 */
export function normalizePhone(raw: any, defaultCountryCode = "242"): string {
  const s = String(raw || "").trim();
  if (!s) return "";

  let p = s.replace(/[^\d+]/g, "");

  if (p.startsWith("00")) p = "+" + p.slice(2);

  if (p.startsWith("+")) {
    // Enlève le 0 qui suit parfois le code pays (ex: +242 0 6 12 34 56 → +2426123456)
    const noPlus = p.slice(1);
    for (const code of ["242", "243", "237", "241", "225", "229"]) {
      if (noPlus.startsWith(code + "0")) {
        return "+" + code + noPlus.slice(code.length + 1);
      }
    }
    return p;
  }

  if (p.startsWith("0")) return `+${defaultCountryCode}${p.slice(1)}`;
  return `+${defaultCountryCode}${p}`;
}
