import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import { parseRollNumber } from "@instigpt/shared";

import type { Env, UserContext } from "../../types";
import { createConfig } from "../../config";
import { createSupabase, createUserRepo, createSessionRepo } from "../../infra/db/supabase";
import { exchangeCodeForProfile } from "../../infra/auth/sso";
import { authMiddleware, SESSION_COOKIE } from "../middleware/auth";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const authRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: UserContext };
}>();

authRoutes.get("/login", async (c) => {
  const code = c.req.query("code");
  if (!code) return c.json({ error: "Missing code" }, 400);

  const config = createConfig(c.env);
  const profile = await exchangeCodeForProfile(code, config);
  if (!profile) return c.json({ error: "SSO authentication failed" }, 400);

  const sb = createSupabase(config);
  const users = createUserRepo(sb);
  const sessions = createSessionRepo(sb);

  const rollInfo = parseRollNumber(profile.roll_number || "");

  const user = await users.upsert({
    id: profile.id,
    username: profile.username,
    name: `${profile.first_name} ${profile.last_name}`.trim(),
    email: profile.email,
    roll_number: profile.roll_number,
    department: rollInfo?.department,
    year: rollInfo?.year,
    program: rollInfo?.program,
  });

  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000);
  const session = await sessions.create(user.id, expiresAt);

  setCookie(c, SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return c.json({ user });
});

authRoutes.get("/logout", async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    const config = createConfig(c.env);
    const sb = createSupabase(config);
    const sessions = createSessionRepo(sb);
    await sessions.destroy(sessionId);
  }

  deleteCookie(c, SESSION_COOKIE);
  return c.json({ success: true });
});

authRoutes.get("/me", authMiddleware, (c) => {
  return c.json({ user: c.get("user") });
});
