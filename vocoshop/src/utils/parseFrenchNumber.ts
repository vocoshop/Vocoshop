export function parseFrenchNumber(input: string): number {
  let s = input.trim();
  s = s.replace(/\s*(FCFA|F|CFA)\s*$/i, "");
  s = s.replace(/\s/g, "");
  // Supprimer les points de milliers (ex: 10.000, 1.500) mais pas les decimals (1.5, 1.500,50)
  s = s.replace(/\.(?=\d{3}(?:[.,]|$))/g, "");
  s = s.replace(/,/g, ".");
  const n = Number(s);
  return isNaN(n) ? 0 : n;
}

export function evalSum(input: string): number {
  const s = input.trim();
  if (s.includes("+")) {
    return s.split("+").reduce((sum, part) => sum + parseFrenchNumber(part), 0);
  }
  return parseFrenchNumber(s);
}

export function formatMoney(n: number | undefined | null): string {
  const v = Math.round(Number(n) || 0);
  return v.toLocaleString("fr-FR");
}
