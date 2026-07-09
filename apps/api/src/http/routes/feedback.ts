/**
 * Feedback HTTP route — stores user feedback on messages.
 */
/**
 * Feedback route.
 * Stores thumbs up/down from users so we can track which answers
 * are good and which need improvement. Includes optional reason
 * categories (wrong info, irrelevant, incomplete, hallucination,
 * outdated) to identify systematic retrieval/prompting issues.
 */
import { Hono } from "hono";
import type { Env, UserContext } from "../../types";
import { createConfig } from "../../config";
import { createSupabase } from "../../infra/db/supabase";
import { authMiddleware } from "../middleware/auth";

export type FeedbackReason =
  | "wrong_info"
  | "irrelevant"
  | "incomplete"
  | "hallucination"
  | "outdated";

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
    reason?: FeedbackReason;
    comment?: string;
  }>();

  if (!body.message_id || !body.conversation_id || !body.type) {
    return c.json({ error: "message_id, conversation_id, and type are required" }, 400);
  }

  if (body.type !== "positive" && body.type !== "negative") {
    return c.json({ error: "type must be 'positive' or 'negative'" }, 400);
  }

  const validReasons: FeedbackReason[] = [
    "wrong_info", "irrelevant", "incomplete", "hallucination", "outdated",
  ];
  if (body.reason && !validReasons.includes(body.reason)) {
    return c.json({ error: `reason must be one of: ${validReasons.join(", ")}` }, 400);
  }

  const user = c.get("user");
  const config = createConfig(c.env);
  const sb = createSupabase(config);

  const { error } = await sb.from("feedback").insert({
    message_id: body.message_id,
    conversation_id: body.conversation_id,
    user_id: user.id,
    type: body.type,
    reason: body.reason || null,
    comment: body.comment?.slice(0, 500) || null,
  });

  if (error) {
    return c.json({ error: "Failed to save feedback" }, 500);
  }

  return c.json({ success: true });
});
