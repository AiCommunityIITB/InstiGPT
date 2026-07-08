/**
 * Advanced RAG pipeline — SOTA retrieval techniques.
 *
 * 1. Query Expansion: Generate multiple search queries from one question
 * 2. Parallel Retrieval: Search with all expanded queries
 * 3. Re-ranking: Use LLM to score chunk relevance
 * 4. Contextual Compression: Extract only relevant sentences from top chunks
 * 5. Adaptive Retrieval: Adjust strategy based on query type
 */
import type { Source } from "@instigpt/shared";
import type { LLMPort, SearchPort, EmbeddingPort, WebSearchPort } from "./service";

// ═══ Query Classification ═══

type QueryType = "factual" | "opinion" | "procedural" | "exploratory" | "casual";

function classifyQuery(query: string): QueryType {
  const q = query.toLowerCase().trim();

  // Casual/greetings
  if (q.split(" ").length <= 4 &&
    /^(hi|hello|hey|how are you|thanks|thank you|okay|ok|bye|good|fine|nice|great|sup|yo)/i.test(q)) {
    return "casual";
  }

  // Procedural — how to do something
  if (/^(how (do|to|can|should)|what('s| is) the (process|procedure|way)|steps to|guide)/i.test(q)) {
    return "procedural";
  }

  // Factual — specific facts, numbers, dates
  if (/^(what|when|where|who|which|how (many|much))\b/i.test(q) &&
    !/(best|recommend|should|opinion|think)/i.test(q)) {
    return "factual";
  }

  // Opinion/recommendation
  if (/(best|recommend|should|worth|review|opinion|easy|difficult|compare)/i.test(q)) {
    return "opinion";
  }

  // Default to exploratory
  return "exploratory";
}

// ═══ Query Expansion ═══

async function expandQuery(
  query: string,
  queryType: QueryType,
  llm: LLMPort
): Promise<string[]> {
  // For factual queries, keep it tight — don't dilute with variants
  if (queryType === "factual" || queryType === "casual") {
    return [query];
  }

  const prompt = `Generate 2 alternative search queries for finding information about this question in a university knowledge base. Make them diverse — one more specific, one more general.

Original: "${query}"

Return ONLY the 2 queries, one per line. No numbering, no explanations.`;

  const result = await llm.complete(prompt);
  if (!result) return [query];

  const variants = result
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5 && l.length < 200);

  return [query, ...variants.slice(0, 2)];
}

// ═══ Parallel Multi-Query Retrieval ═══

async function multiQueryRetrieve(
  queries: string[],
  embedding: EmbeddingPort,
  search: SearchPort,
  webSearch: WebSearchPort,
  queryType: QueryType
): Promise<Source[]> {
  // Adaptive limits based on query type
  const ragLimit = queryType === "factual" ? 5 : 8;
  const webLimit = queryType === "procedural" ? 4 : 2;

  // Embed all queries in parallel
  const embeddings = await Promise.all(
    queries.map((q) => embedding.embed(q))
  );

  // Search with all queries in parallel
  const searchPromises = embeddings.map((emb, i) =>
    search.search(emb, queries[i], ragLimit)
  );
  const webPromise = webSearch.search(queries[0], webLimit);

  const [webResults, ...ragResults] = await Promise.all([
    webPromise,
    ...searchPromises,
  ]);

  // Deduplicate by content (fuzzy — first 100 chars)
  const seen = new Set<string>();
  const allSources: Source[] = [];

  for (const results of ragResults) {
    for (const source of results) {
      const key = source.content_snippet.slice(0, 100).toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      allSources.push(source);
    }
  }

  for (const source of webResults) {
    allSources.push(source);
  }

  return allSources;
}

// ═══ LLM Re-ranking ═══

async function rerankSources(
  sources: Source[],
  query: string,
  llm: LLMPort,
  topK: number = 6
): Promise<Source[]> {
  if (sources.length <= 3) return sources;

  // Take top candidates by initial score for re-ranking (avoid LLM overuse)
  const candidates = sources
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, 12);

  const snippets = candidates
    .map((s, i) => `[${i}] ${s.content_snippet.slice(0, 300)}`)
    .join("\n\n");

  const prompt = `Given this question: "${query}"

Rate each passage's relevance (0-10). Return ONLY comma-separated scores in order, nothing else.

${snippets}

Scores:`;

  const result = await llm.complete(prompt);
  if (!result) return candidates.slice(0, topK);

  // Parse scores
  const scores = result
    .replace(/[^0-9,.\s]/g, "")
    .split(/[,\s]+/)
    .map((s) => parseFloat(s))
    .filter((n) => !isNaN(n));

  // Apply LLM scores as a re-ranking signal
  const reranked = candidates.map((source, i) => ({
    ...source,
    relevance_score: scores[i] !== undefined
      ? (source.relevance_score * 0.3) + (scores[i] / 10 * 0.7)
      : source.relevance_score,
  }));

  return reranked
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, topK);
}

// ═══ Contextual Compression ═══

async function compressSources(
  sources: Source[],
  query: string,
  llm: LLMPort
): Promise<Source[]> {
  // Only compress document sources with long content
  const docsToCompress = sources.filter(
    (s) => s.source_type === "document" && s.content_snippet.length > 200
  );
  const others = sources.filter(
    (s) => s.source_type !== "document" || s.content_snippet.length <= 200
  );

  if (docsToCompress.length === 0) return sources;

  const snippets = docsToCompress
    .map((s, i) => `[${i}] ${s.content_snippet}`)
    .join("\n---\n");

  const prompt = `Extract ONLY the sentences directly relevant to: "${query}"

From these passages:
${snippets}

For each passage, return the relevant extract (1-3 sentences max). Format: [index] extracted text
If a passage has nothing relevant, write [index] SKIP`;

  const result = await llm.complete(prompt);
  if (!result) return sources;

  // Parse compressed results
  const compressed = new Map<number, string>();
  for (const line of result.split("\n")) {
    const match = line.match(/^\[(\d+)\]\s*(.+)/);
    if (match) {
      const idx = parseInt(match[1]);
      const text = match[2].trim();
      if (text !== "SKIP" && text.length > 10) {
        compressed.set(idx, text);
      }
    }
  }

  // Rebuild sources with compressed content
  const compressedSources = docsToCompress
    .map((source, i) => {
      if (compressed.has(i)) {
        return { ...source, content_snippet: compressed.get(i)! };
      }
      return null; // Filtered out — not relevant
    })
    .filter((s): s is Source => s !== null);

  return [...others, ...compressedSources]
    .sort((a, b) => b.relevance_score - a.relevance_score);
}

// ═══ Main RAG Pipeline ═══

export interface RAGInput {
  query: string;
  llm: LLMPort;
  search: SearchPort;
  embedding: EmbeddingPort;
  webSearch: WebSearchPort;
}

export interface RAGResult {
  sources: Source[];
  queryType: QueryType;
  expandedQueries: string[];
}

/**
 * Full SOTA RAG pipeline:
 * classify → expand → retrieve → re-rank → compress
 */
export async function ragPipeline(input: RAGInput): Promise<RAGResult> {
  const { query, llm, search, embedding, webSearch } = input;

  // 1. Classify query type
  const queryType = classifyQuery(query);

  if (queryType === "casual") {
    return { sources: [], queryType, expandedQueries: [query] };
  }

  // 2. Expand query (generates 1-3 variants)
  const expandedQueries = await expandQuery(query, queryType, llm);

  // 3. Multi-query parallel retrieval
  const rawSources = await multiQueryRetrieve(
    expandedQueries,
    embedding,
    search,
    webSearch,
    queryType
  );

  // 4. Re-rank using LLM (only if we have enough candidates)
  const reranked = rawSources.length > 3
    ? await rerankSources(rawSources, query, llm, 6)
    : rawSources;

  // 5. Contextual compression (extract relevant sentences)
  const compressed = await compressSources(reranked, query, llm);

  return {
    sources: compressed,
    queryType,
    expandedQueries,
  };
}
