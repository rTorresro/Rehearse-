// sliding-window limiter per key (an IP, usually). anything that spends money or runs
// someone else's code sits behind one. in-memory: fine for one server, not for a fleet
export function createRateLimiter(opts: { windowMs: number; max: number }) {
  const hits = new Map<string, number[]>();
  return function limited(key: string) {
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < opts.windowMs);
    recent.push(now);
    hits.set(key, recent);
    return recent.length > opts.max;
  };
}
