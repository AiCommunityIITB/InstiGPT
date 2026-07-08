/**
 * Supabase hybrid search adapter.
 * Combines vector similarity, full-text search, and knowledge graph traversal.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchPort } from "../../domain/chat";
import type { Source } from "@instigpt/shared";

export function createHybridSearch(supabase: SupabaseClient): SearchPort {
  return {
    async search(embedding, query, limit = 10): Promise<Source[]> {
      const [vectorResults, keywordResults, graphResults] = await Promise.all([
        vectorSearch(supabase, embedding, limit),
        keywordSearch(supabase, query, limit),
        graphSearch(supabase, query),
      ]);

      return mergeAndRank(vectorResults, keywordResults, graphResults, limit);
    },
  };
}

// ─── Internal search strategies ───

interface RawResult {
  id: string;
  content: string;
  source: string;
  metadata: Record<string, unknown>;
  similarity: number;
}

interface GraphEntity {
  id: string;
  name: string;
  type: string;
  metadata: Record<string, unknown>;
  relations: Array<{
    relation: string;
    target_name: string;
    target_type: string;
    target_metadata: Record<string, unknown>;
  }>;
}

async function vectorSearch(
  sb: SupabaseClient,
  embedding: number[],
  limit: number
): Promise<RawResult[]> {
  const { data } = await sb.rpc("search_chunks", {
    query_embedding: embedding,
    match_count: limit,
    similarity_threshold: 0.3,
  });
  return data || [];
}

async function keywordSearch(
  sb: SupabaseClient,
  query: string,
  limit: number
): Promise<RawResult[]> {
  const { data } = await sb.rpc("keyword_search_chunks", {
    search_query: query,
    match_count: limit,
  });
  return data || [];
}

async function graphSearch(
  sb: SupabaseClient,
  query: string
): Promise<GraphEntity[]> {
  // Try structured entity lookup first (course codes, etc.)
  const coursePattern = /[A-Z]{2,4}\s*\d{3}/g;
  const courses = query.match(coursePattern);

  if (courses && courses.length > 0) {
    return searchByCourseCode(sb, courses[0]);
  }

  // Fall back to fuzzy entity search
  const { data } = await sb.rpc("search_entities", {
    search_query: query,
    match_count: 5,
  });

  return (data || []).map((e: any) => ({
    ...e,
    relations: e.relations || [],
  }));
}

async function searchByCourseCode(
  sb: SupabaseClient,
  code: string
): Promise<GraphEntity[]> {
  const normalized = code.replace(/\s+/, " ").trim();

  const { data: entity } = await sb
    .from("entities")
    .select("*")
    .ilike("name", `%${normalized}%`)
    .eq("type", "course")
    .limit(1)
    .single();

  if (!entity) return [];

  const { data: relations } = await sb
    .from("relationships")
    .select("relation, target:entities!relationships_target_id_fkey(name, type, metadata)")
    .eq("source_id", entity.id);

  return [
    {
      id: entity.id,
      name: entity.name,
      type: entity.type,
      metadata: entity.metadata,
      relations: (relations || []).map((r: any) => ({
        relation: r.relation,
        target_name: r.target.name,
        target_type: r.target.type,
        target_metadata: r.target.metadata,
      })),
    },
  ];
}

// ─── Merge & rank ───

function mergeAndRank(
  vector: RawResult[],
  keyword: RawResult[],
  graph: GraphEntity[],
  limit: number
): Source[] {
  const seen = new Set<string>();
  const sources: Source[] = [];

  // Graph results (highest precision) → weight 1.0
  for (const entity of graph) {
    const relText = entity.relations
      .map((r) => `${r.relation}: ${r.target_name}`)
      .join("; ");
    sources.push({
      title: entity.name,
      content_snippet: `${entity.name} (${entity.type}): ${JSON.stringify(entity.metadata)}. ${relText}`,
      source_type: "graph",
      metadata: entity.metadata,
      relevance_score: 0.95,
    });
    seen.add(entity.id);
  }

  // Vector results → weight 0.4
  for (const r of vector) {
    if (seen.has(r.id)) continue;
    seen.add(r.id);
    sources.push({
      title: r.source,
      content_snippet: r.content,
      source_type: "document",
      metadata: r.metadata,
      relevance_score: 0.4 * r.similarity,
    });
  }

  // Keyword results → boost existing or add with 0.3 weight
  for (const r of keyword) {
    if (seen.has(r.id)) {
      const existing = sources.find((s) => s.content_snippet === r.content);
      if (existing) existing.relevance_score += 0.3 * r.similarity;
      continue;
    }
    seen.add(r.id);
    sources.push({
      title: r.source,
      content_snippet: r.content,
      source_type: "document",
      metadata: r.metadata,
      relevance_score: 0.3 * r.similarity,
    });
  }

  return sources.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, limit);
}
