/**
 * Jina Reranker adapter.
 *
 * Cross-encoder reranking using Jina AI's free API.
 * Called AFTER RRF fusion to re-order the top candidates using
 * a model that understands paraphrases and semantic similarity
 * far better than our term-overlap heuristic.
 *
 * Free tier: 1M tokens/month — more than enough for InstiGPT's traffic.
 * Falls back gracefully to the original order if the API is unavailable.
 */
import type { Source } from "@instigpt/shared";

const JINA_RERANK_URL = "https://api.jina.ai/v1/rerank";

export interface RerankerPort {
  /** Rerank sources by relevance to query. Returns top N. */
  rerank(query: string, sources: Source[], topN?: number): Promise<Source[]>;
}

/**
 * Creates a Jina-powered reranker.
 * If no API key is provided, returns a no-op reranker that passes through.
 */
export function createJinaReranker(apiKey?: string): RerankerPort {
  if (!apiKey) {
    return createNoopReranker();
  }

  return {
    async rerank(query: string, sources: Source[], topN = 6): Promise<Source[]> {
      if (sources.length <= 1) return sources;

      try {
        const documents = sources.map((s) => s.content_snippet.slice(0, 1000));

        const res = await fetch(JINA_RERANK_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: "jina-reranker-v2-base-multilingual",
            query,
            documents,
            top_n: Math.min(topN, sources.length),
          }),
        });

        if (!res.ok) {
          // Graceful degradation: return original order on API failure
          return sources.slice(0, topN);
        }

        const data = (await res.json()) as {
          results: Array<{ index: number; relevance_score: number }>;
        };

        // Map reranked indices back to sources with updated scores
        return data.results.map((r) => ({
          ...sources[r.index],
          relevance_score: r.relevance_score,
        }));
      } catch {
        // Network error — fall back to original order
        return sources.slice(0, topN);
      }
    },
  };
}

/**
 * No-op reranker — used when no API key is configured.
 * Simply returns the first N sources in their existing order.
 */
function createNoopReranker(): RerankerPort {
  return {
    async rerank(_query: string, sources: Source[], topN = 6): Promise<Source[]> {
      return sources.slice(0, topN);
    },
  };
}
