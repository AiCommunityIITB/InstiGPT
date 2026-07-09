/**
 * Rate limiting middleware.
 *
 * Uses a sliding window: 15 messages per minute per user.
 * Storage is in-memory, which means limits reset on worker cold start.
 * That's fine for our scale. If we ever need persistence, swap to
 * Workers KV or Upstash Redis.
 */
import { Context, Next } from "hono";
import type { Env, UserContext } from "../../types";

interface RateLimitEntry {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitEntry>();

const WINDOW_MS = 60 * 1000; // 1 minute
const MAX_REQUESTS = 15;

// Periodic cleanup every 5 minutes
let lastCleanup = Date.now();
const CLEANUP_INTERVAL = 5 * 60 * 1000;

function cleanup() {
  const now = Date.now();
  if (now - lastCleanup < CLEANUP_INTERVAL) return;
  lastCleanup = now;

  for (const [key, entry] of rateLimitStore.entries()) {
    entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);
    if (entry.timestamps.length === 0) {
      rateLimitStore.delete(key);
    }
  }
}

export async function rateLimitMiddleware(
  c: Context<{ Bindings: Env; Variables: { user: UserContext } }>,
  next: Next
) {
  cleanup();

  const user = c.get("user");
  const userId = user?.id || "unknown";
  const now = Date.now();

  let entry = rateLimitStore.get(userId);
  if (!entry) {
    entry = { timestamps: [] };
    rateLimitStore.set(userId, entry);
  }

  // Remove timestamps outside the window
  entry.timestamps = entry.timestamps.filter((t) => now - t < WINDOW_MS);

  const remaining = MAX_REQUESTS - entry.timestamps.length;
  const resetTime = entry.timestamps.length > 0
    ? Math.ceil((entry.timestamps[0] + WINDOW_MS) / 1000)
    : Math.ceil((now + WINDOW_MS) / 1000);

  // Set rate limit headers
  c.header("X-RateLimit-Limit", String(MAX_REQUESTS));
  c.header("X-RateLimit-Remaining", String(Math.max(0, remaining)));
  c.header("X-RateLimit-Reset", String(resetTime));

  if (remaining <= 0) {
    return c.json(
      {
        error: "Rate limit exceeded. Maximum 15 messages per minute.",
        code: "RATE_LIMIT_EXCEEDED",
      },
      429
    );
  }

  // Record this request
  entry.timestamps.push(now);

  await next();
}
