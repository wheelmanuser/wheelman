// Small per-instance memory cache. Entries expire after ttlMs; the oldest are evicted past maxEntries.
export function createTtlCache<T>(ttlMs: number, maxEntries = 500) {
  const entries = new Map<string, { value: T; expiresAt: number }>();
  return {
    get(key: string, now: number = Date.now()): T | undefined {
      const hit = entries.get(key);
      if (!hit) return undefined;
      if (hit.expiresAt <= now) {
        entries.delete(key);
        return undefined;
      }
      return hit.value;
    },
    set(key: string, value: T, now: number = Date.now()): void {
      entries.delete(key);
      entries.set(key, { value, expiresAt: now + ttlMs });
      while (entries.size > maxEntries) {
        const oldest = entries.keys().next().value;
        if (oldest === undefined) break;
        entries.delete(oldest);
      }
    },
  };
}
