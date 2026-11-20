import { randomUUID } from "node:crypto";
import { getDb } from "./db";
import { HttpError } from "./errors";
import { hashForBucket } from "./crypto";

export type RateLimitResult = {
  allowed: boolean;
  remaining: number;
  retryAfter?: number;
};

export function getClientIpKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const real = request.headers.get("x-real-ip")?.trim();
  const cloudflare = request.headers.get("cf-connecting-ip")?.trim();
  return hashForBucket(forwarded || real || cloudflare || "unknown-client");
}

export function bucketKey(value: string): string {
  return hashForBucket(value);
}

export function checkRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const db = getDb();
  const now = Date.now();
  const cutoff = now - windowMs;

  return db.transaction(() => {
    db.prepare("DELETE FROM rate_limit_hits WHERE occurred_at < ?").run(now - 24 * 60 * 60 * 1000);
    const countRow = db
      .prepare("SELECT COUNT(*) AS count FROM rate_limit_hits WHERE bucket_key = ? AND occurred_at >= ?")
      .get(key, cutoff) as { count: number };
    if (countRow.count >= limit) {
      const oldest = db
        .prepare("SELECT MIN(occurred_at) AS earliest FROM rate_limit_hits WHERE bucket_key = ? AND occurred_at >= ?")
        .get(key, cutoff) as { earliest: number | null };
      const retryAfter = Math.max(1, Math.ceil(((oldest.earliest ?? now) + windowMs - now) / 1000));
      return { allowed: false, remaining: 0, retryAfter };
    }
    db.prepare("INSERT INTO rate_limit_hits (id, bucket_key, occurred_at) VALUES (?, ?, ?)").run(randomUUID(), key, now);
    return { allowed: true, remaining: Math.max(0, limit - countRow.count - 1) };
  })();
}

export function assertRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const result = checkRateLimit(key, limit, windowMs);
  if (!result.allowed) {
    throw new HttpError(
      429,
      `Too many requests. Try again in ${result.retryAfter ?? 1} second${result.retryAfter === 1 ? "" : "s"}.`,
      "RATE_LIMITED",
      undefined,
      { "Retry-After": String(result.retryAfter ?? 1) }
    );
  }
  return result;
}
