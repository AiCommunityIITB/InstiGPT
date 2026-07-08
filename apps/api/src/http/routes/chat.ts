/**
 * Chat HTTP route — thin controller.
 * Its only job: parse request → call domain → format SSE response.
 */
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import type { Env, UserContext } from "../../types";
import { createConfig } from "../../config";
import { createSupabase, createMessageStore, createConversationStore } from "../../infra/db/supabase";
import { createGeminiLLM } from "../../infra/llm/gemini";
import { createCFEmbedding, createLocalEmbedding } from "../../infra/embeddings/cloudflare";
import { createHybridSearch } from "../../infra/search/hybrid";
import { createDDGSearch } from "../../infra/search/web";
import { chat } from "../../domain/chat";
import { authMiddleware } from "../middleware/auth";

export const chatRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: UserContext };
}>();

chatRoutes.use("*", authMiddleware);

chatRoutes.post("/", async (c) => {
  const { question, conversation_id } = await c.req.json<{
    question: string;
    conversation_id?: string;
  }>();

  if (!question?.trim()) {
    return c.json({ error: "Question is required" }, 400);
  }

  const user = c.get("user");
  const config = createConfig(c.env);
  const sb = createSupabase(config);

  // Wire up dependencies (this is the composition root for this request)
  const deps = {
    llm: createGeminiLLM(config.geminiApiKey),
    search: createHybridSearch(sb),
    embedding: c.env.AI ? createCFEmbedding(c.env.AI) : createLocalEmbedding(),
    webSearch: createDDGSearch(),
    messages: createMessageStore(sb),
    conversations: createConversationStore(sb),
  };

  return streamSSE(c, async (stream) => {
    const events = chat(
      { question: question.trim(), conversationId: conversation_id, user },
      deps
    );

    for await (const event of events) {
      switch (event.type) {
        case "metadata":
          await stream.writeSSE({
            event: "metadata",
            data: JSON.stringify({ conversation_id: event.conversationId }),
          });
          break;
        case "sources":
          await stream.writeSSE({
            event: "sources",
            data: JSON.stringify(event.sources),
          });
          break;
        case "token":
          await stream.writeSSE({ event: "token", data: event.token });
          break;
        case "done":
          await stream.writeSSE({ event: "done", data: "{}" });
          break;
        case "error":
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ error: event.message }),
          });
          break;
      }
    }
  });
});
