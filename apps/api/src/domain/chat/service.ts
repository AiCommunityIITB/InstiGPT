/**
 * Chat service: the core of InstiGPT.
 *
 * This is an async generator that orchestrates the entire chat flow:
 * 1. Create or resolve the conversation
 * 2. Condense follow-up questions using chat history
 * 3. Run the RAG pipeline (retrieval + ranking)
 * 4. Stream the LLM response token by token
 * 5. Save messages to the database
 * 6. Generate a title (if first message) and follow-up suggestions
 *
 * The function depends only on interfaces (ports), never on concrete
 * implementations. All I/O is injected via the `deps` object.
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
  updateTitle(id: string, title: string): Promise<void>;
}

// ═══ Chat Service ═══

export interface ChatDeps {
  llm: LLMPort;
  search: SearchPort;
  embedding: EmbeddingPort;
  webSearch: WebSearchPort;
  messages: MessageStore;
  conversations: ConversationStore;
  reranker?: import("../../infra/search/reranker").RerankerPort;
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
  | { type: "error"; message: string }
  | { type: "title"; title: string }
  | { type: "followups"; questions: string[] };

/**
 * Core chat orchestration.
 * This is where the "intelligence" lives:
 * - Condenses follow-up questions
 * - Runs hybrid retrieval
 * - Streams LLM responses
 * - Persists messages
 * - Generates title for first exchange
 * - Generates follow-up questions (in parallel with streaming)
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
  const isFirstExchange = history.length === 0;

  // 3. Condense question if there's history + extract conversation topic
  let searchQuery = question;
  if (history.length > 0) {
    const condensed = await deps.llm.complete(
      buildCondensePrompt(question, history)
    );
    searchQuery = condensed || question;

    // Enrich with conversation topic (last few messages give topic context)
    const topicContext = extractConversationTopic(history);
    if (topicContext && !searchQuery.toLowerCase().includes(topicContext.toLowerCase())) {
      searchQuery = `${topicContext}: ${searchQuery}`;
    }
  }

  // 4. Run production RAG pipeline (route → rewrite → expand → retrieve → RRF → confidence)
  const ragResult = await ragPipeline({
    query: searchQuery,
    llm: deps.llm,
    search: deps.search,
    embedding: deps.embedding,
    webSearch: deps.webSearch,
    reranker: deps.reranker,
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

  // 5. Start follow-up generation in parallel (fire-and-forget promise)
  // This runs concurrently while the LLM streams the main answer
  const followupPromise = generateFollowups(deps.llm, question, allSources);

  // 6. Build prompt with relevance-filtered history
  const relevantHistory = filterHistoryByRelevance(history, question);
  const systemPrompt = buildSystemPrompt(allSources, user, ragResult.confidence, ragResult);
  const messages = [
    ...relevantHistory.map((m) => ({
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

  // 10. Generate title if this is the first exchange
  if (isFirstExchange) {
    try {
      const titlePrompt = `Generate a short 4-6 word title for this conversation based on the question and answer. Return ONLY the title, nothing else.\n\nQuestion: ${question}\n\nAnswer: ${fullContent.slice(0, 500)}`;
      const title = await deps.llm.complete(titlePrompt);
      const cleanTitle = title.replace(/^["']|["']$/g, "").trim();
      if (cleanTitle && cleanTitle.length > 0) {
        await deps.conversations.updateTitle(conversationId, cleanTitle);
        yield { type: "title", title: cleanTitle };
      }
    } catch {
      // Title generation is non-critical, silently ignore failures
    }
  }

  // 11. Await follow-up questions (already computed in parallel)
  try {
    const followups = await followupPromise;
    if (followups.length > 0) {
      yield { type: "followups", questions: followups };
    }
  } catch {
    // Follow-up generation is non-critical, silently ignore failures
  }
}

// ═══ Parallel Follow-up Generation ═══
// Starts generating follow-ups as soon as sources are ready,
// runs concurrently with the main LLM stream (saves 1-2s)

async function generateFollowups(
  llm: LLMPort,
  question: string,
  sources: Source[]
): Promise<string[]> {
  // Use sources context to generate more relevant follow-ups
  const contextHint = sources
    .slice(0, 3)
    .map((s) => s.title)
    .filter(Boolean)
    .join(", ");

  const prompt = `Based on this question about IIT Bombay and these source topics, suggest 3 brief follow-up questions the student might ask next. Make each distinct and specific.${contextHint ? ` Topics found: ${contextHint}.` : ""} Return ONLY a JSON array of 3 strings, nothing else.

Question: "${question}"`;

  const raw = await llm.complete(prompt);
  const parsed = JSON.parse(raw);
  if (Array.isArray(parsed) && parsed.length > 0) {
    return [...new Set(parsed as string[])].slice(0, 3);
  }
  return [];
}

// ═══ Relevance-Based History Filtering ═══
// Instead of blindly taking the last N messages, keep the most recent
// exchanges plus older messages that are topically relevant to the
// current question. Reduces noise and saves tokens.

function filterHistoryByRelevance(
  history: Message[],
  currentQuestion: string,
  maxMessages: number = 10
): Message[] {
  if (history.length <= 4) return history; // Short history: keep all

  // Always keep the last 2 exchanges (4 messages) for immediate context
  const recentCount = Math.min(4, history.length);
  const recent = history.slice(-recentCount);
  const older = history.slice(0, -recentCount);

  if (older.length === 0) return recent;

  // Score older messages by keyword overlap with current question
  const queryTerms = currentQuestion
    .toLowerCase()
    .split(/\s+/)
    .filter((t) => t.length > 2);

  const scored = older.map((msg) => {
    const content = msg.content.toLowerCase();
    const matchCount = queryTerms.filter((t) => content.includes(t)).length;
    const score = matchCount / Math.max(queryTerms.length, 1);
    return { msg, score };
  });

  // Keep messages that have at least some relevance (> 20% term overlap)
  const relevant = scored
    .filter((s) => s.score > 0.2)
    .sort((a, b) => b.score - a.score)
    .slice(0, maxMessages - recentCount)
    .map((s) => s.msg);

  // Combine and maintain chronological order
  const combined = [...relevant, ...recent];
  combined.sort((a, b) =>
    new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );

  return combined.slice(-maxMessages);
}

// ═══ Prompt Construction (domain logic, not infra) ═══

function buildSystemPrompt(sources: Source[], user?: UserContext, confidence?: string, ragResult?: { queryType: string }): string {
  let prompt = `You are InstiGPT, a helpful assistant for IIT Bombay students.

Rules:
- Answer primarily using the provided context when it's relevant and helpful.
- If the context is insufficient or irrelevant, use your general knowledge about IIT Bombay.
- If you're truly unsure, say so and suggest where to check.
- Be concise but complete. Finish every sentence fully.
- Do not repeat the question back.
- When referencing specific information from the context, cite inline like [Source Name].
- Only cite when making a specific factual claim from the documents.

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

  // Fun/roast mode
  if (ragResult?.queryType === "fun") {
    prompt += `\n\nIMPORTANT: The user wants something fun or a roast.
- For roasts: Be savage but affectionate. Use specific IITB stereotypes (night-outs before exams, relative grading trauma, hostel food complaints, department rivalries, placement anxiety). Keep it 2-3 sentences, punchy. No disclaimers.
- For fun facts: Give genuinely obscure, surprising facts that only someone who studied at IITB would know. NOT generic things like "Mood Indigo is big" or "campus is near a forest" — those are boring. Think: specific traditions, hidden spots on campus, weird rules, legendary incidents, quirky professor stories, or absurd statistics.`;
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

/**
 * Extract the ongoing topic from conversation history.
 * Looks at the last few user messages to identify a consistent topic.
 */
function extractConversationTopic(history: Message[]): string | null {
  const userMessages = history
    .filter((m) => m.role === "user")
    .slice(-4)
    .map((m) => m.content.toLowerCase());

  if (userMessages.length === 0) return null;

  // Common topic patterns
  const topicPatterns: [RegExp, string][] = [
    [/(cs|cse|computer science)/i, "CSE"],
    [/(mech|mechanical)/i, "Mechanical Engineering"],
    [/(elec|electrical|ee)/i, "Electrical Engineering"],
    [/(civil)/i, "Civil Engineering"],
    [/(aero|aerospace)/i, "Aerospace Engineering"],
    [/(chem|chemical)/i, "Chemical Engineering"],
    [/(branch change)/i, "branch change"],
    [/(minor|minors)/i, "minor degree"],
    [/(honors|honour)/i, "honors"],
    [/(placement|intern)/i, "placements"],
    [/(hostel)/i, "hostel"],
    [/(course|elective)/i, "courses"],
    [/(cpi|spi|grade|grading)/i, "grading"],
  ];

  // Check if recent messages share a topic
  for (const [pattern, topic] of topicPatterns) {
    const matches = userMessages.filter((m) => pattern.test(m));
    if (matches.length >= 2) return topic;
  }

  return null;
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
