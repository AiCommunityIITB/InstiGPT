/**
 * Production-grade RAG pipeline.
 *
 * Techniques borrowed from:
 * - Onyx (30.8k ⭐): Hybrid search + reranking + confidence scoring
 * - Verba (7.7k ⭐): Sentence-window retrieval + query routing
 * - VectorHub: Reciprocal Rank Fusion (RRF) for hybrid merge
 * - Azure RAG Template: Semantic ranking + metadata filtering
 *
 * Design principles:
 * 1. Minimize LLM calls (max 1 pre-generation call)
 * 2. Maximize retrieval precision with RRF fusion
 * 3. Only show sources when retrieval is confident
 * 4. Route queries to appropriate strategies
 */
import type { Source } from "@instigpt/shared";
import type { LLMPort, SearchPort, EmbeddingPort, WebSearchPort } from "./service";

// ═══ Query Router ═══

export type QueryIntent =
  | "knowledge"    // needs RAG (courses, rules, profs, clubs)
  | "web_needed"   // needs web search (current events, deadlines)
  | "conversational" // casual, greeting, thanks
  | "meta";        // about InstiGPT itself

function routeQuery(query: string): QueryIntent {
  const q = query.toLowerCase().trim();

  // Conversational
  if (q.split(" ").length <= 5 &&
    /^(hi|hello|hey|how are you|thanks|thank you|okay|ok|bye|good|fine|nice|great|sup|yo|what's up)/i.test(q)) {
    return "conversational";
  }

  // Meta (about the bot itself)
  if (/(who (are|made|built) you|what (are|can) you|instigpt|your (name|purpose))/i.test(q)) {
    return "meta";
  }

  // Web-needed (time-sensitive or external)
  if (/(today|tomorrow|current|latest|this week|this month|2025|2026|placement|intern.*(season|drive)|fest.*date)/i.test(q)) {
    return "web_needed";
  }

  // Default: knowledge retrieval
  return "knowledge";
}

// ═══ Multi-Query Generation (1 LLM call max) ═══

async function generateSearchQueries(
  query: string,
  intent: QueryIntent,
  llm: LLMPort
): Promise<string[]> {
  // Only expand for complex knowledge queries
  if (intent !== "knowledge" || query.split(" ").length <= 5) {
    return [query];
  }

  const prompt = `Generate 2 search queries to find information about: "${query}"
Make one specific and one general. Return ONLY 2 queries, one per line.`;

  const result = await llm.complete(prompt);
  if (!result) return [query];

  const variants = result
    .split("\n")
    .map((l) => l.replace(/^\d+[.)]\s*/, "").trim())
    .filter((l) => l.length > 5 && l.length < 200);

  return [query, ...variants.slice(0, 2)];
}

// ═══ Reciprocal Rank Fusion (RRF) ═══
// Industry standard for merging multiple ranked lists
// Used by Elasticsearch, Onyx, and Azure AI Search

function reciprocalRankFusion(
  rankedLists: Source[][],
  k: number = 60 // standard RRF constant
): Source[] {
  const scoreMap = new Map<string, { source: Source; score: number }>();

  for (const list of rankedLists) {
    for (let rank = 0; rank < list.length; rank++) {
      const source = list[rank];
      const key = source.content_snippet.slice(0, 80).toLowerCase().replace(/\s+/g, " ");
      const rrfScore = 1 / (k + rank + 1);

      if (scoreMap.has(key)) {
        scoreMap.get(key)!.score += rrfScore;
      } else {
        scoreMap.set(key, { source, score: rrfScore });
      }
    }
  }

  return Array.from(scoreMap.values())
    .sort((a, b) => b.score - a.score)
    .map(({ source, score }) => ({
      ...source,
      relevance_score: score,
    }));
}

// ═══ Confidence Scoring ═══
// Determines if retrieval actually found useful results

interface ConfidenceResult {
  sources: Source[];
  confidence: "high" | "medium" | "low" | "none";
}

function scoreConfidence(sources: Source[], query: string): ConfidenceResult {
  if (sources.length === 0) {
    return { sources: [], confidence: "none" };
  }

  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  // Check term coverage across TOP 3 sources (not just first)
  let totalCoverage = 0;
  const topN = Math.min(sources.length, 3);
  for (let i = 0; i < topN; i++) {
    const content = sources[i].content_snippet.toLowerCase();
    const title = (sources[i].title || "").toLowerCase();
    const combined = content + " " + title;
    const matchedTerms = queryTerms.filter((t) => combined.includes(t));
    totalCoverage += matchedTerms.length / Math.max(queryTerms.length, 1);
  }
  const avgCoverage = totalCoverage / topN;

  // Check if sources are just URLs or metadata (low-quality chunks)
  const topContent = sources[0].content_snippet;
  const isJustUrl = /^https?:\/\//.test(topContent.trim()) && topContent.length < 200;

  // High confidence: strong term match across multiple sources, not just URLs
  if (avgCoverage >= 0.5 && !isJustUrl) {
    return { sources, confidence: "high" };
  }

  // Medium: decent match, real content
  if (avgCoverage >= 0.3 && !isJustUrl && topContent.length > 100) {
    return { sources, confidence: "medium" };
  }

  // Low: weak match — sources probably not relevant
  return { sources: sources.slice(0, 2), confidence: "low" };
}

// ═══ Context Window Optimizer ═══
// Fits sources into LLM's context budget, prioritizing quality

function optimizeForContext(
  sources: Source[],
  confidence: "high" | "medium" | "low" | "none",
  maxChars: number = 8000
): Source[] {
  if (confidence === "none") return [];

  // For low confidence, use minimal context to avoid confusing the LLM
  const budget = confidence === "low" ? Math.min(maxChars, 2000) : maxChars;
  const maxSources = confidence === "high" ? 6 : confidence === "medium" ? 4 : 2;

  let totalChars = 0;
  const selected: Source[] = [];

  for (const source of sources.slice(0, maxSources)) {
    const len = source.content_snippet.length;
    if (totalChars + len > budget) {
      // Include truncated last source if we have room
      const remaining = budget - totalChars;
      if (remaining > 100) {
        selected.push({
          ...source,
          content_snippet: source.content_snippet.slice(0, remaining),
        });
      }
      break;
    }
    totalChars += len;
    selected.push(source);
  }

  return selected;
}

// ═══ Main Pipeline ═══

export interface RAGInput {
  query: string;
  llm: LLMPort;
  search: SearchPort;
  embedding: EmbeddingPort;
  webSearch: WebSearchPort;
}

export interface RAGResult {
  sources: Source[];
  queryType: QueryIntent;
  confidence: "high" | "medium" | "low" | "none";
  expandedQueries: string[];
}

export async function ragPipeline(input: RAGInput): Promise<RAGResult> {
  const { query, llm, search, embedding, webSearch } = input;

  // 1. Route the query
  const queryType = routeQuery(query);

  if (queryType === "conversational" || queryType === "meta") {
    return { sources: [], queryType, confidence: "none", expandedQueries: [query] };
  }

  // 2. Generate search queries (0-1 LLM calls)
  const expandedQueries = await generateSearchQueries(query, queryType, llm);

  // 3. Parallel retrieval with all queries
  const embeddings = await Promise.all(expandedQueries.map((q) => embedding.embed(q)));

  const retrievalPromises: Promise<Source[]>[] = [
    // Vector search with each expanded query
    ...embeddings.map((emb, i) => search.search(emb, expandedQueries[i], 8)),
  ];

  // Add web search for web_needed queries
  if (queryType === "web_needed") {
    retrievalPromises.push(webSearch.search(query, 4));
  } else {
    retrievalPromises.push(webSearch.search(query, 2));
  }

  const results = await Promise.all(retrievalPromises);

  // 4. Separate web results from RAG results for different fusion
  const webResults = results[results.length - 1];
  const ragResults = results.slice(0, -1);

  // 5. Apply Reciprocal Rank Fusion to RAG results
  const fusedRAG = reciprocalRankFusion(ragResults);

  // 6. Merge web results (placed after RAG results)
  const allSources = [
    ...fusedRAG,
    ...webResults.map((s) => ({ ...s, relevance_score: 0.01 })), // Web gets lowest RRF
  ];

  // 7. Score confidence
  const { sources: scoredSources, confidence } = scoreConfidence(allSources, query);

  // 8. Optimize for context window
  const optimized = optimizeForContext(scoredSources, confidence);

  return {
    sources: optimized,
    queryType,
    confidence,
    expandedQueries,
  };
}
