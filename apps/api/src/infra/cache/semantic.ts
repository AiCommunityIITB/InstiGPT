/**
 * Semantic cache — stores and retrieves cached RAG responses
 * based on query embedding similarity.
 */
import { SupabaseClient } from "@supabase/supabase-js";

export interface SemanticCache {
  /** Check cache for a semantically similar query */
  check(embedding: number[], threshold?: number): Promise<CacheHit | null>;
  /** Store a new cache entry (expires after 24 hours) */
  store(queryText: string, queryEmbedding: number[], response: string, sources: any[]): Promise<void>;
}

export interface CacheHit {
  query_text: string;
  response: string;
  sources: any[];
}

export function createSemanticCache(sb: SupabaseClient): SemanticCache {
  return {
    async check(embedding, threshold = 0.98) {
      const { data, error } = await sb.rpc("search_cache", {
        query_embedding: JSON.stringify(embedding),
        similarity_threshold: threshold,
      });

      if (error || !data || data.length === 0) return null;

      const hit = data[0];
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
