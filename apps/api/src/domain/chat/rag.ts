/**
 * Advanced RAG pipeline — optimized for low-quota LLMs.
 *
 * Strategy: maximize retrieval quality WITHOUT burning LLM calls.
 * - Query expansion via LLM (1 call, only for complex queries)
 * - Multi-query parallel retrieval
 * - Heuristic re-ranking (no LLM needed — uses scoring signals)
 * - Smart context assembly (truncate, not compress)
 *
 * Total LLM budget per request: 1 call (expansion) + 1 call (final answer)
 * For simple queries: 0 + 1 = 1 LLM call total
 */
import type { Source } from "@instigpt/shared";
import type { LLMPort, SearchPort, EmbeddingPort, WebSearchPort } from "./service";

// ═══ Query Classification ═══

type QueryType = "factual" | "opinion" | "procedural" | "exploratory" | "casual";

function classifyQuery(query: string): QueryType {
  const q = query.toLowerCase().trim();

  if (q.split(" ").length <= 4 &&
    /^(hi|hello|hey|how are you|thanks|thank you|okay|ok|bye|good|fine|nice|great|sup|yo)/i.test(q)) {
    return "casual";
  }

  if (/^(how (do|to|can|should)|what('s| is) the (process|procedure|way)|steps to|guide)/i.test(q)) {
    return "procedural";
  }

  if (/^(what|when|where|who|which|how (many|much))\b/i.test(q) &&
    !/(best|recommend|should|opinion|think)/i.test(q)) {
    return "factual";
  }

  if (/(best|recommend|should|worth|review|opinion|easy|difficult|compare)/i.test(q)) {
    return "opinion";
  }

  return "exploratory";
}

// ═══ Query Expansion (single LLM call, only for complex queries) ═══

async function expandQuery(
  query: string,
  queryType: QueryType,
  llm: LLMPort
): Promise<string[]> {
  // Simple queries don't need expansion
  if (queryType === "factual" || queryType === "casual") {
    return [query];
  }

  const prompt = `Generate 2 alternative search queries for: "${query}"
One more specific, one more general. One per line, no numbering.`;

  const result = await llm.complete(prompt);
  if (!result) return [query];

  const variants = result
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 5 && l.length < 200);

  return [query, ...variants.slice(0, 2)];
}

// ═══ Multi-Query Retrieval ═══

async function multiQueryRetrieve(
  queries: string[],
  embedding: EmbeddingPort,
  search: SearchPort,
  webSearch: WebSearchPort,
  queryType: QueryType
): Promise<Source[]> {
  const ragLimit = queryType === "factual" ? 5 : 8;
  const webLimit = queryType === "procedural" ? 4 : 2;

  // Embed all queries in parallel
  const embeddings = await Promise.all(queries.map((q) => embedding.embed(q)));

  // Search with all queries + web in parallel
  const allPromises = [
    webSearch.search(queries[0], webLimit),
    ...embeddings.map((emb, i) => search.search(emb, queries[i], ragLimit)),
  ];

  const [webResults, ...ragResults] = await Promise.all(allPromises);

  // Deduplicate by content fingerprint
  const seen = new Set<string>();
  const allSources: Source[] = [];

  for (const results of ragResults) {
    for (const source of results) {
      const key = source.content_snippet.slice(0, 80).toLowerCase().replace(/\s+/g, " ");
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

// ═══ Heuristic Re-ranking (no LLM needed) ═══

function rerankHeuristic(sources: Source[], query: string): Source[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);

  return sources
    .map((source) => {
      let boost = 0;
      const content = source.content_snippet.toLowerCase();

      // Boost: exact phrase match
      if (content.includes(query.toLowerCase())) {
        boost += 0.3;
      }

      // Boost: term coverage — what % of query terms appear in the chunk
      const matchedTerms = queryTerms.filter((t) => content.includes(t));
      const termCoverage = matchedTerms.length / Math.max(queryTerms.length, 1);
      boost += termCoverage * 0.2;

      // Boost: graph sources (structured data is more reliable)
      if (source.source_type === "graph") {
        boost += 0.15;
      }

      // Boost: shorter, more focused chunks (less noise)
      if (source.content_snippet.length < 500) {
        boost += 0.05;
      }

      // Penalty: very short chunks (likely incomplete)
      if (source.content_snippet.length < 50) {
        boost -= 0.1;
      }

      return {
        ...source,
        relevance_score: source.relevance_score + boost,
      };
    })
    .sort((a, b) => b.relevance_score - a.relevance_score);
}

// ═══ Smart Context Assembly ═══

function assembleContext(sources: Source[], maxTokenBudget: number = 3000): Source[] {
  // Estimate ~4 chars per token
  const charBudget = maxTokenBudget * 4;
  let totalChars = 0;
  const selected: Source[] = [];

  for (const source of sources) {
    const snippetLength = source.content_snippet.length;
    if (totalChars + snippetLength > charBudget) {
      // Truncate the last chunk to fit
      if (selected.length < 2) {
        selected.push({
          ...source,
          content_snippet: source.content_snippet.slice(0, charBudget - totalChars),
        });
      }
      break;
    }
    totalChars += snippetLength;
    selected.push(source);
  }

  return selected;
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
 * Optimized RAG pipeline:
 * classify → expand (1 LLM call max) → multi-retrieve → heuristic re-rank → assemble
 */
export async function ragPipeline(input: RAGInput): Promise<RAGResult> {
  const { query, llm, search, embedding, webSearch } = input;

  // 1. Classify query type
  const queryType = classifyQuery(query);

  if (queryType === "casual") {
    return { sources: [], queryType, expandedQueries: [query] };
  }

  // 2. Expand query (1 LLM call for non-factual, 0 for factual)
  const expandedQueries = await expandQuery(query, queryType, llm);

  // 3. Multi-query parallel retrieval
  const rawSources = await multiQueryRetrieve(
    expandedQueries, embedding, search, webSearch, queryType
  );

  // 4. Heuristic re-ranking (fast, no LLM)
  const reranked = rerankHeuristic(rawSources, query);

  // 5. Smart context assembly (fit within token budget)
  const assembled = assembleContext(reranked);

  return {
    sources: assembled,
    queryType,
    expandedQueries,
  };
}
