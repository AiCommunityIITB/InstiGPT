/**
 * Auth middleware — validates session cookie.
 * Supports anonymous users with a 5-message limit.
 */
import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, UserContext } from "../../types";
import { createConfig } from "../../config";
import { createSupabase, createSessionRepo } from "../../infra/db/supabase";

export const SESSION_COOKIE = "instigpt_session";

// In-memory message counter for anonymous users
const anonMessageCount = new Map<string, number>();
const ANON_MESSAGE_LIMIT = 5;

function hashIp(ip: string): string {
  // Simple FNV-1a hash for IP
  let hash = 2166136261;
  for (let i = 0; i < ip.length; i++) {
    hash ^= ip.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export async function authMiddleware(
  c: Context<{ Bindings: Env; Variables: { user: UserContext } }>,
  next: Next
) {
  // Dev bypass — skip auth in local development
  if (c.env.ENVIRONMENT === "development") {
    c.set("user", {
      id: "dev-001",
      username: "devuser",
      name: "Dev User",
      email: "dev@iitb.ac.in",
      roll_number: "210070042",
      department: "Computer Science & Engineering",
      year: 2021,
      program: "BTech",
    });
    await next();
    return;
  }

  const sessionId = getCookie(c, SESSION_COOKIE);

  // If no session cookie, create anonymous user context
  if (!sessionId) {
    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "0.0.0.0";
    const ipHash = hashIp(ip);
    const anonId = `anon-${ipHash}`;

    // Check message count for this anonymous user
    const count = anonMessageCount.get(anonId) || 0;
    if (count >= ANON_MESSAGE_LIMIT) {
      return c.json(
        { error: "Sign up to continue", code: "ANON_LIMIT" },
        401
      );
    }

    // Increment message count
    anonMessageCount.set(anonId, count + 1);

    c.set("user", {
      id: anonId,
      username: "anonymous",
      name: "Anonymous",
      email: "",
      roll_number: "",
    });
    await next();
    return;
  }

  const config = createConfig(c.env);
  const sb = createSupabase(config);
  const sessions = createSessionRepo(sb);

  const user = await sessions.validate(sessionId);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  c.set("user", user);
  await next();
}
