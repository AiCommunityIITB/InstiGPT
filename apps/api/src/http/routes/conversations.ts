import { Hono } from "hono";
import type { Env, UserContext } from "../../types";
import { createConfig } from "../../config";
import { createSupabase, createConversationRepo } from "../../infra/db/supabase";
import { authMiddleware } from "../middleware/auth";

export const conversationRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: UserContext };
}>();

conversationRoutes.use("*", authMiddleware);

conversationRoutes.get("/", async (c) => {
  const user = c.get("user");
  const sb = createSupabase(createConfig(c.env));
  const repo = createConversationRepo(sb);
  return c.json({ conversations: await repo.list(user.id) });
});

conversationRoutes.get("/:id/messages", async (c) => {
  const user = c.get("user");
  const sb = createSupabase(createConfig(c.env));
  const repo = createConversationRepo(sb);

  const conv = await repo.getById(c.req.param("id"), user.id);
  if (!conv) return c.json({ error: "Not found" }, 404);

  return c.json({ messages: await repo.getMessages(conv.id) });
});

conversationRoutes.post("/", async (c) => {
  const user = c.get("user");
  const { title } = await c.req.json<{ title: string }>();
  const sb = createSupabase(createConfig(c.env));
  const repo = createConversationRepo(sb);
  return c.json({ conversation: await repo.create(user.id, title || "New conversation") });
});

conversationRoutes.patch("/:id", async (c) => {
  const user = c.get("user");
  const { title } = await c.req.json<{ title: string }>();
  const sb = createSupabase(createConfig(c.env));
  const repo = createConversationRepo(sb);
  const updated = await repo.rename(c.req.param("id"), user.id, title);
  if (!updated) return c.json({ error: "Not found" }, 404);
  return c.json({ conversation: updated });
});

conversationRoutes.delete("/:id", async (c) => {
  const user = c.get("user");
  const sb = createSupabase(createConfig(c.env));
  const repo = createConversationRepo(sb);
  await repo.remove(c.req.param("id"), user.id);
  return c.json({ success: true });
});
