import Counter from "../models/Counter";

/**
* Atomic counter (safe concurrency)
* key: "agent"
* startAt: 1000 => first returned = 1001
*/
export async function getNextSequence(
key: string,
startAt = 1000
): Promise<number> {
// Pipeline update: seq = (seq ?? startAt) + 1
const doc = await Counter.findOneAndUpdate(
  { key },
  [
    {
      $set: {
        key: key,
        seq: { $add: [{ $ifNull: ["$seq", startAt] }, 1] },
      },
    },
  ] as any,
  { upsert: true, new: true }
).lean();

return Number((doc as any)?.seq ?? startAt + 1);
}

export function randomSuffix(): string {
const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const i = Math.floor(Math.random() * letters.length);
return letters[i];
}

export function buildAgentCode(n: number, suffix: string): string {
const s = String(suffix || "").trim().toUpperCase().slice(0, 1) || "A";
return `AG-${n}-${s}`;
}

export function generateAuthCode(len = 6): string {
const min = Math.pow(10, len - 1);
const max = Math.pow(10, len) - 1;
return String(Math.floor(Math.random() * (max - min + 1)) + min);
}
