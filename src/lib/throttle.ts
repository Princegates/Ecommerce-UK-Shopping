/**
 * Small in-memory limiter: at most `max` recorded events per key within `windowMs`.
 * It lives in one server process. If the site runs on several instances, move the
 * counters to a shared store such as Redis.
 */
export function createLimiter(max: number, windowMs: number) {
  const hits = new Map<string, { count: number; resetAt: number }>();

  function prune(now: number) {
    if (hits.size < 5000) return;
    for (const [k, v] of hits) if (v.resetAt < now) hits.delete(k);
  }

  return {
    allowed(key: string, now = Date.now()): boolean {
      const h = hits.get(key);
      return !h || h.resetAt < now || h.count < max;
    },
    record(key: string, now = Date.now()): void {
      prune(now);
      const h = hits.get(key);
      if (!h || h.resetAt < now) hits.set(key, { count: 1, resetAt: now + windowMs });
      else h.count += 1;
    },
    clear(key: string): void {
      hits.delete(key);
    },
  };
}
