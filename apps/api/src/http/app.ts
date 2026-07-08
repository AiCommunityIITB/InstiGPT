/**
 * Application entry point.
 * Only responsibilities: middleware setup and route mounting.
 * All business logic lives in domain/, all I/O in infra/.
 */
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";

import type { Env } from "../types";
import { authRoutes } from "./routes/auth";
import { chatRoutes } from "./routes/chat";
import { conversationRoutes } from "./routes/conversations";

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  // ─── Global middleware ───
  app.use("*", logger());
  app.use(
    "*",
    cors({
      origin: [
      "http://localhost:3000",
      "https://instigpt.vercel.app",
      "https://insti-gpt-web.vercel.app",
    ],
      credentials: true,
      allowMethods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
      allowHeaders: ["Content-Type", "Authorization"],
    })
  );

  // ─── Routes ───
  app.get("/", (c) =>
    c.json({ status: "ok", service: "instigpt-api", version: "2.0.0" })
  );

  app.route("/auth", authRoutes);
  app.route("/chat", chatRoutes);
  app.route("/conversations", conversationRoutes);

  // ─── Error handling ───
  app.notFound((c) => c.json({ error: "Not found" }, 404));
  app.onError((err, c) => {
    console.error("Unhandled:", err.message);
    return c.json({ error: "Internal server error" }, 500);
  });

  return app;
}
