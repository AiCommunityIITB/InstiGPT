/**
 * Chat domain — pure business logic.
 *
 * This module defines WHAT the chat system does, not HOW.
 * It depends only on interfaces (ports), never on concrete implementations.
 */
import type { UserContext } from "../../types";
import type { Source, Message } from "@instigpt/shared";
import { ragPipeline } from "./rag";

// ═══ Ports (interfaces that infra must implement) ═══

export interface LLMPort {
  /** Stream a completion, yielding tokens */
  streamCompletion(params: {
    systemPrompt: string;
    messages: Array<{ role: "user" | "assistant"; content: string }>;
  }): AsyncIterable<string>;

  /** Single-shot completion (for question condensing) */
  complete(prompt: string): Promise<string>;
}

export interface SearchPort {
  /** Hybrid search: vector + keyword + graph */
  search(embedding: number[], query: string, limit?: number): Promise<Source[]>;
}

export interface EmbeddingPort {
  /** Generate embeddings for text */
  embed(text: string): Promise<number[]>;
}

export interface WebSearchPort {
  /** Search the web for supplementary results */
  search(query: string, maxResults?: number): Promise<Source[]>;
}

export interface MessageStore {
  getHistory(conversationId: string, limit?: number): Promise<Message[]>;
  saveMessage(msg: Omit<Message, "id" | "created_at">): Promise<Message>;
}

export interface ConversationStore {
  create(userId: string, title: string): Promise<{ id: string }>;
  updateTimestamp(id: string): Promise<void>;
}

// ═══ Chat Service ═══

export interface ChatDeps {
  llm: LLMPort;
  search: SearchPort;
  embedding: EmbeddingPort;
  webSearch: WebSearchPort;
  messages: MessageStore;
  conversations: ConversationStore;
}

export interface ChatInput {
  question: string;
  conversationId?: string;
  user: UserContext;
}

export interface ChatResult {
  conversationId: string;
  stream: AsyncIterable<ChatStreamEvent>;
}

export type ChatStreamEvent =
  | { type: "metadata"; conversationId: string }
  | { type: "sources"; sources: Source[] }
  | { type: "token"; token: string }
  | { type: "done" }
  | { type: "error"; message: string };

/**
 * Core chat orchestration.
 * This is where the "intelligence" lives:
 * - Condenses follow-up questions
 * - Runs hybrid retrieval
 * - Streams LLM responses
 * - Persists messages
 */
export async function* chat(
  input: ChatInput,
  deps: ChatDeps
): AsyncGenerator<ChatStreamEvent> {
  const { question, user } = input;

  // 1. Resolve conversation
  let conversationId = input.conversationId;
  if (!conversationId) {
    const conv = await deps.conversations.create(user.id, question.slice(0, 100));
    conversationId = conv.id;
  }

  yield { type: "metadata", conversationId };

  // 2. Get chat history
  const history = await deps.messages.getHistory(conversationId, 20);

  // 3. Condense question if there's history
  let searchQuery = question;
  if (history.length > 0) {
    const condensed = await deps.llm.complete(
      buildCondensePrompt(question, history)
    );
    searchQuery = condensed || question;
  }

  // 4. Run production RAG pipeline (route → expand → retrieve → RRF → confidence)
  const ragResult = await ragPipeline({
    query: searchQuery,
    llm: deps.llm,
    search: deps.search,
    embedding: deps.embedding,
    webSearch: deps.webSearch,
  });

  const allSources = ragResult.sources;

  // Only show sources to user when retrieval is confident
  const displaySources = ragResult.confidence === "high" || ragResult.confidence === "medium"
    ? deduplicateSources(allSources)
        .slice(0, 5)
        .map((s) => ({
          ...s,
          content_snippet: s.content_snippet.slice(0, 200),
        }))
    : [];

  yield { type: "sources", sources: displaySources };

  // 6. Build prompt (adapt based on retrieval confidence)
  const systemPrompt = buildSystemPrompt(allSources, user, ragResult.confidence);
  const messages = [
    ...history.slice(-10).map((m) => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user" as const, content: question },
  ];

  // 7. Save user message
  await deps.messages.saveMessage({
    role: "user",
    content: question,
    conversation_id: conversationId,
  });

  // 8. Stream LLM response
  let fullContent = "";
  try {
    for await (const token of deps.llm.streamCompletion({
      systemPrompt,
      messages,
    })) {
      fullContent += token;
      yield { type: "token", token };
    }
  } catch (err) {
    yield { type: "error", message: "Failed to generate response" };
    return;
  }

  // 9. Save assistant message
  await deps.messages.saveMessage({
    role: "assistant",
    content: fullContent,
    conversation_id: conversationId,
  });

  await deps.conversations.updateTimestamp(conversationId);

  yield { type: "done" };
}

// ═══ Prompt Construction (domain logic, not infra) ═══

function buildSystemPrompt(sources: Source[], user?: UserContext, confidence?: string): string {
  let prompt = `You are InstiGPT, a helpful assistant for IIT Bombay students.

Rules:
- Answer primarily using the provided context when it's relevant and helpful.
- If the context is insufficient or irrelevant, use your general knowledge about IIT Bombay.
- If you're truly unsure, say so and suggest where to check.
- Be concise but complete. Finish every sentence fully.
- Do not repeat the question back.
- Do not cite sources in your response. Sources are shown separately.

Format:
- Write in complete sentences. Never break a sentence across lines.
- Use blank lines only between distinct paragraphs or before lists.
- For lists, use "- " prefix.
- Keep responses 3-6 sentences for simple questions, longer for complex ones.
- Never use markdown formatting (no bold, headers, or code blocks).
- Never insert line breaks within words or abbreviations (B.Tech, M.Tech, Ph.D., etc.).
- Write abbreviations as single unbroken tokens: BTech, MTech, PhD, CPI, SPI, IITB.`;

  // Adapt based on retrieval confidence
  if (confidence === "none" || confidence === "low") {
    prompt += `\n\nNote: The retrieved context may not be directly relevant. Rely more on your general knowledge about IITB.`;
  }

  if (user?.department || user?.program) {
    prompt += `\n\nStudent: ${user.name || "Unknown"}, ${user.program || ""} ${user.department || ""}, Year ${user.year || "?"}`;
  }

  // Attach context
  const graphSources = sources.filter((s) => s.source_type === "graph");
  const docSources = sources.filter((s) => s.source_type === "document");
  const webSources = sources.filter((s) => s.source_type === "web_search");

  const parts: string[] = [];

  if (graphSources.length > 0) {
    parts.push(
      "[Structured Knowledge]\n" +
        graphSources.map((s) => s.content_snippet).join("\n")
    );
  }
  if (docSources.length > 0) {
    parts.push(
      "[Documents — pre-filtered for relevance]\n" +
        docSources
          .slice(0, 6)
          .map((s) => `[${s.title}] ${s.content_snippet}`)
          .join("\n---\n")
    );
  }
  if (webSources.length > 0) {
    parts.push(
      "[Web Results]\n" + webSources.map((s) => `[${s.title}] ${s.content_snippet}`).join("\n")
    );
  }

  if (parts.length > 0) {
    prompt += `\n\n--- CONTEXT ---\n${parts.join("\n\n")}`;
  }

  return prompt;
}

function deduplicateSources(sources: Source[]): Source[] {
  const seen = new Set<string>();
  return sources.filter((s) => {
    const key = s.title.toLowerCase().trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function buildCondensePrompt(question: string, history: Message[]): string {
  const historyText = history
    .slice(-6)
    .map((m) => `${m.role}: ${m.content}`)
    .join("\n");

  return `Given this conversation:\n${historyText}\n\nRewrite this follow-up as a standalone question: "${question}"\n\nStandalone:`;
}
