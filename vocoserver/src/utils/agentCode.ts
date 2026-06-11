// src/utils/agentCode.ts
export function suffixFromNumber(n: number): string {
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const idx = (Math.max(1, n) - 1) % 26; // 1->A ... 26->Z ... 27->A
return letters[idx];
}

export function buildAgentCode(codeNumber: number): { code: string; codeSuffix: string } {
const suffix = suffixFromNumber(codeNumber);
return { code: `AG-${codeNumber}-${suffix}`, codeSuffix: suffix };
}
