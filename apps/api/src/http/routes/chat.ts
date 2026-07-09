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
import { createSemanticCache } from "../../infra/cache/semantic";
import { chat } from "../../domain/chat";
import { authMiddleware } from "../middleware/auth";
import { rateLimitMiddleware } from "../middleware/rateLimit";

export const chatRoutes = new Hono<{
  Bindings: Env;
  Variables: { user: UserContext };
}>();

chatRoutes.use("*", authMiddleware);
chatRoutes.use("*", rateLimitMiddleware);

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
  const embeddingPort = c.env.AI ? createCFEmbedding(c.env.AI) : createLocalEmbedding();
  const cache = createSemanticCache(sb);

  // Check semantic cache before running full RAG pipeline
  const queryEmbedding = await embeddingPort.embed(question.trim());
  const cacheHit = await cache.check(queryEmbedding);

  if (cacheHit) {
    // Stream cached response token-by-token for consistent UX
    return streamSSE(c, async (stream) => {
      // Create conversation if needed
      let convId = conversation_id;
      if (!convId) {
        const conversations = createConversationStore(sb);
        const conv = await conversations.create(user.id, question.slice(0, 100));
        convId = conv.id;
      }

      await stream.writeSSE({
        event: "metadata",
        data: JSON.stringify({ conversation_id: convId }),
      });

      await stream.writeSSE({
        event: "sources",
        data: JSON.stringify(cacheHit.sources),
      });

      // Stream cached response token-by-token
      const words = cacheHit.response.split(" ");
      for (let i = 0; i < words.length; i++) {
        const token = i === 0 ? words[i] : " " + words[i];
        await stream.writeSSE({ event: "token", data: token });
      }

      await stream.writeSSE({ event: "done", data: "{}" });
    });
  }

  // Wire up dependencies (this is the composition root for this request)
  const deps = {
    llm: createGeminiLLM(config.geminiApiKey),
    search: createHybridSearch(sb),
    embedding: embeddingPort,
    webSearch: createDDGSearch(),
    messages: createMessageStore(sb),
    conversations: createConversationStore(sb),
  };

  return streamSSE(c, async (stream) => {
    let fullContent = "";
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
          fullContent += event.token;
          await stream.writeSSE({ event: "token", data: event.token });
          break;
        case "done":
          await stream.writeSSE({ event: "done", data: "{}" });
          break;
        case "title":
          await stream.writeSSE({
            event: "title",
            data: JSON.stringify({ title: event.title }),
          });
          break;
        case "followups":
          await stream.writeSSE({
            event: "followups",
            data: JSON.stringify(event.questions),
          });
          break;
        case "error":
          await stream.writeSSE({
            event: "error",
            data: JSON.stringify({ error: event.message }),
          });
          break;
      }
    }

    // Store in semantic cache after successful response
    if (fullContent.length > 0) {
      try {
        await cache.store(question.trim(), queryEmbedding, fullContent, []);
      } catch {
        // Cache storage is non-critical
      }
    }
  });
});
