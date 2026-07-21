// Minimal in-memory rate limiter (fixed window). Suitable for a single-node
// deployment, which is the intended footprint of this application.
const buckets = new Map(); // key -> { count, resetAt }

export function take(key, max, windowMs) {
  const now = Date.now();
  if (buckets.size > 10000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k);
  }
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= max;
}

export function resetAll() {
  buckets.clear();
}
