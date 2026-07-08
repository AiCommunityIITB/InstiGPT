import { Hono } from "hono";
import { setCookie, deleteCookie, getCookie } from "hono/cookie";
import type { Env, UserContext } from "../../types";
import { createConfig } from "../../config";
import { createSupabase } from "../../infra/db/supabase";
import { authMiddleware, SESSION_COOKIE } from "../middleware/auth";

const SESSION_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export const authRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: UserContext };
}>();

// Sign up with email + password
authRoutes.post("/signup", async (c) => {
  const { email, password, name } = await c.req.json<{
    email: string;
    password: string;
    name: string;
  }>();

  if (!email || !password || !name) {
    return c.json({ error: "Email, password, and name are required" }, 400);
  }
  if (password.length < 6) {
    return c.json({ error: "Password must be at least 6 characters" }, 400);
  }

  const config = createConfig(c.env);
  const sb = createSupabase(config);

  // Check if user exists
  const { data: existing } = await sb
    .from("users")
    .select("id")
    .eq("email", email)
    .single();

  if (existing) {
    return c.json({ error: "Account already exists" }, 400);
  }

  // Hash password (simple hash for now — use bcrypt in production via a KV or external service)
  const passwordHash = await hashPassword(password);

  // Create user
  const { data: user, error } = await sb
    .from("users")
    .insert({
      id: crypto.randomUUID(),
      username: email.split("@")[0],
      name,
      email,
      password_hash: passwordHash,
      roll_number: "",
    })
    .select()
    .single();

  if (error) {
    return c.json({ error: "Failed to create account" }, 500);
  }

  // Create session
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  const { data: session } = await sb
    .from("sessions")
    .insert({ user_id: user.id, expires_at: expiresAt })
    .select("id")
    .single();

  if (!session) {
    return c.json({ error: "Failed to create session" }, 500);
  }

  setCookie(c, SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return c.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// Login with email + password
authRoutes.post("/login", async (c) => {
  const { email, password } = await c.req.json<{
    email: string;
    password: string;
  }>();

  if (!email || !password) {
    return c.json({ error: "Email and password are required" }, 400);
  }

  const config = createConfig(c.env);
  const sb = createSupabase(config);

  // Find user
  const { data: user } = await sb
    .from("users")
    .select("*")
    .eq("email", email)
    .single();

  if (!user || !user.password_hash) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Verify password
  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) {
    return c.json({ error: "Invalid email or password" }, 401);
  }

  // Create session
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE * 1000).toISOString();
  const { data: session } = await sb
    .from("sessions")
    .insert({ user_id: user.id, expires_at: expiresAt })
    .select("id")
    .single();

  if (!session) {
    return c.json({ error: "Failed to create session" }, 500);
  }

  setCookie(c, SESSION_COOKIE, session.id, {
    httpOnly: true,
    secure: true,
    sameSite: "None",
    maxAge: SESSION_MAX_AGE,
    path: "/",
  });

  return c.json({ user: { id: user.id, email: user.email, name: user.name } });
});

// Logout
authRoutes.get("/logout", async (c) => {
  const sessionId = getCookie(c, SESSION_COOKIE);
  if (sessionId) {
    const config = createConfig(c.env);
    const sb = createSupabase(config);
    await sb.from("sessions").delete().eq("id", sessionId);
  }
  deleteCookie(c, SESSION_COOKIE);
  return c.json({ success: true });
});

// Get current user
authRoutes.get("/me", authMiddleware, (c) => {
  return c.json({ user: c.get("user") });
});

// ─── Password hashing (SHA-256 based, suitable for Workers) ───

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomUUID();
  const data = new TextEncoder().encode(salt + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${salt}:${hashHex}`;
}

async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const [salt, expectedHash] = stored.split(":");
  const data = new TextEncoder().encode(salt + password);
  const hash = await crypto.subtle.digest("SHA-256", data);
  const hashHex = Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hashHex === expectedHash;
}
