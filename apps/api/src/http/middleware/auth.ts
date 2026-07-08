/**
 * Auth middleware — validates session cookie.
 * Thin: just extracts the cookie and delegates to the session repo.
 */
import { Context, Next } from "hono";
import { getCookie } from "hono/cookie";
import type { Env, UserContext } from "../../types";
import { createConfig } from "../../config";
import { createSupabase, createSessionRepo } from "../../infra/db/supabase";

export const SESSION_COOKIE = "instigpt_session";

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
  if (!sessionId) return c.json({ error: "Unauthorized" }, 401);

  const config = createConfig(c.env);
  const sb = createSupabase(config);
  const sessions = createSessionRepo(sb);

  const user = await sessions.validate(sessionId);
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  c.set("user", user);
  await next();
}
