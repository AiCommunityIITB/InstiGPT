/**
 * Feedback HTTP route — stores user feedback on messages.
 */
/**
 * Feedback route.
 * Stores thumbs up/down from users so we can track which answers
 * are good and which need improvement. This data will eventually
 * feed into evaluation and prompt tuning.
 */
import { Hono } from "hono";
import type { Env, UserContext } from "../../types";
import { createConfig } from "../../config";
import { createSupabase } from "../../infra/db/supabase";
import { authMiddleware } from "../middleware/auth";

export const feedbackRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: UserContext };
}>();

feedbackRoutes.use("*", authMiddleware);

feedbackRoutes.post("/", async (c) => {
  const body = await c.req.json<{
    message_id: string;
    conversation_id: string;
    type: "positive" | "negative";
  }>();

  if (!body.message_id || !body.conversation_id || !body.type) {
    return c.json({ error: "message_id, conversation_id, and type are required" }, 400);
  }

  if (body.type !== "positive" && body.type !== "negative") {
    return c.json({ error: "type must be 'positive' or 'negative'" }, 400);
  }

  const user = c.get("user");
  const config = createConfig(c.env);
  const sb = createSupabase(config);

  const { error } = await sb.from("feedback").insert({
    message_id: body.message_id,
    conversation_id: body.conversation_id,
    user_id: user.id,
    type: body.type,
  });

  if (error) {
    return c.json({ error: "Failed to save feedback" }, 500);
  }

  return c.json({ success: true });
});
