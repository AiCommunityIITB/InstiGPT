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
import { createJinaReranker } from "../../infra/search/reranker";
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

  // Only use cache for longer knowledge-type queries.
  // Short queries, fun/roast, meta, and conversational queries skip cache.
  const q = question.trim().toLowerCase();
  const isCacheable =
    q.split(" ").length > 4 &&
    !/(roast|joke|funny|meme|fun fact|stereotype|savage|burn)/i.test(q) &&
    !/(who (are|made|built) you|what (are|can) you|instigpt|who am i)/i.test(q) &&
    !/^(hi|hello|hey|thanks|okay|ok|bye|sup|yo)/i.test(q);

  // Check cache (embedding + text overlap guard)
  let cacheHit = null;
  let queryEmbedding: number[] | null = null;
  if (isCacheable) {
    queryEmbedding = await embeddingPort.embed(question.trim());
    cacheHit = await cache.check(queryEmbedding, question.trim());
  }

  if (cacheHit) {
    return streamSSE(c, async (stream) => {
      let convId = conversation_id;
      const conversations = createConversationStore(sb);
      const messages = createMessageStore(sb);

      if (!convId) {
        const conv = await conversations.create(user.id, question.slice(0, 100));
        convId = conv.id;
      }

      await stream.writeSSE({ event: "metadata", data: JSON.stringify({ conversation_id: convId }) });
      await stream.writeSSE({ event: "sources", data: JSON.stringify(cacheHit.sources) });

      // Stream cached response word by word
      const words = cacheHit.response.split(" ");
      for (let i = 0; i < words.length; i++) {
        await stream.writeSSE({ event: "token", data: i === 0 ? words[i] : " " + words[i] });
      }

      await stream.writeSSE({ event: "done", data: "{}" });

      // Persist messages
      await messages.saveMessage({ role: "user", content: question.trim(), conversation_id: convId });
      await messages.saveMessage({ role: "assistant", content: cacheHit.response, conversation_id: convId });
      await conversations.updateTimestamp(convId);

      // Generate fresh follow-ups
      try {
        const llm = createGeminiLLM(config.geminiApiKey);
        const raw = await llm.complete(`Based on this Q&A about IIT Bombay, suggest 3 brief distinct follow-up questions. Return ONLY a JSON array of 3 strings.\n\nQ: ${question}\nA: ${cacheHit.response.slice(0, 400)}`);
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          await stream.writeSSE({ event: "followups", data: JSON.stringify([...new Set(parsed)].slice(0, 3)) });
        }
      } catch {}
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
    reranker: createJinaReranker(c.env.JINA_API_KEY),
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

    // Store in cache for future identical questions (only cacheable queries)
    if (fullContent.length > 50 && isCacheable) {
      try {
        const emb = queryEmbedding || await embeddingPort.embed(question.trim());
        await cache.store(question.trim(), emb, fullContent, []);
      } catch {}
    }
  });
});
