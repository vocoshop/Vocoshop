let cached: boolean | null = null;

export function isLowEndDevice(): boolean {
  if (cached !== null) return cached;
  try {
    const mem = (global as any).performance?.memory;
    if (mem?.jsHeapSizeLimit) {
      cached = mem.jsHeapSizeLimit < 2 * 1024 * 1024 * 1024;
      return cached;
    }
  } catch {}
  cached = false;
  return false;
}
