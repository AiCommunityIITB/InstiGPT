/**
 * Semantic cache for RAG responses.
 *
 * Before running the full pipeline (embed + search + LLM), we check if
 * someone has asked a nearly identical question recently. If the cosine
 * similarity is above 0.98 AND the text shares significant word overlap,
 * we return the cached response.
 *
 * The text overlap check is the key safety mechanism. Embedding similarity
 * alone can be fooled (two IITB-related questions might be 0.96+ similar
 * just because they share the same domain). The word overlap ensures we
 * only cache-hit for genuinely near-identical questions.
 *
 * Cache entries expire after 24 hours.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface SemanticCache {
  check(embedding: number[], queryText: string): Promise<CacheHit | null>;
  store(queryText: string, queryEmbedding: number[], response: string, sources: any[]): Promise<void>;
}

export interface CacheHit {
  query_text: string;
  response: string;
  sources: any[];
}

/**
 * Compute word overlap between two texts.
 * Returns a ratio between 0 and 1.
 */
function wordOverlap(a: string, b: string): number {
  const wordsA = new Set(a.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  const wordsB = new Set(b.toLowerCase().split(/\s+/).filter((w) => w.length > 2));
  if (wordsA.size === 0 || wordsB.size === 0) return 0;

  let overlap = 0;
  for (const word of wordsA) {
    if (wordsB.has(word)) overlap++;
  }

  // Use the smaller set as denominator so short queries can still match
  return overlap / Math.min(wordsA.size, wordsB.size);
}

export function createSemanticCache(sb: SupabaseClient): SemanticCache {
  return {
    async check(embedding, queryText) {
      const { data, error } = await sb.rpc("search_cache", {
        query_embedding: JSON.stringify(embedding),
        similarity_threshold: 0.98,
      });

      if (error || !data || data.length === 0) return null;

      const hit = data[0];

      // Safety check: the cached query must share significant words
      // with the new query. This prevents "Roast CSE" matching "Day 1 intern"
      const overlap = wordOverlap(queryText, hit.query_text);
      if (overlap < 0.5) return null;

      return {
        query_text: hit.query_text,
        response: hit.response,
        sources: hit.sources || [],
      };
    },

    async store(queryText, queryEmbedding, response, sources) {
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

      await sb.from("semantic_cache").insert({
        query_text: queryText,
        query_embedding: JSON.stringify(queryEmbedding),
        response,
        sources,
        expires_at: expiresAt,
      });
    },
  };
}
