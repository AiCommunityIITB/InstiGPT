/**
 * Hybrid search adapter.
 *
 * Combines three retrieval strategies in parallel:
 * - Vector search (semantic similarity via pgvector)
 * - Keyword search (Postgres full-text search with ts_rank)
 * - Knowledge graph (entity lookup + relationship traversal)
 *
 * Results from all three are merged, with graph results getting highest
 * priority, then vector, then keyword. The cross-encoder pass at the end
 * re-ranks everything using term overlap and bigram matching.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import type { SearchPort } from "../../domain/chat";
import type { Source } from "@instigpt/shared";

export function createHybridSearch(supabase: SupabaseClient): SearchPort {
  return {
    async search(embedding, query, limit = 10): Promise<Source[]> {
      // Extract metadata filter hints from query
      const metadataFilter = extractMetadataFilter(query);

      const [vectorResults, keywordResults, graphResults] = await Promise.all([
        vectorSearch(supabase, embedding, limit, metadataFilter),
        keywordSearch(supabase, query, limit),
        graphSearch(supabase, query),
      ]);

      const merged = mergeAndRank(vectorResults, keywordResults, graphResults, limit * 2);

      // Cross-encoder re-ranking pass
      const reranked = crossEncoderRerank(merged, query, limit);

      return reranked;
    },
  };
}

// ─── Metadata Filter Extraction ───

interface MetadataFilter {
  sourceHints: string[];  // e.g., ["mech", "mechanical"]
  category?: string;      // e.g., "department", "club"
}

function extractMetadataFilter(query: string): MetadataFilter {
  const q = query.toLowerCase();
  const sourceHints: string[] = [];
  let category: string | undefined;

  // Department detection
  const deptMap: Record<string, string[]> = {
    cse: ["cse", "computer science", "cs dept"],
    mech: ["mech", "mechanical"],
    elec: ["elec", "electrical", "ee dept"],
    civil: ["civil"],
    aero: ["aero", "aerospace"],
    che: ["chemical", "che dept"],
    bio: ["bio", "bioscience", "bsbe"],
    maths: ["math", "mathematics"],
    physics: ["physics"],
    hss: ["hss", "humanities"],
    eco: ["economics", "eco"],
    earth: ["earth science"],
    env: ["environment", "env"],
  };

  for (const [key, terms] of Object.entries(deptMap)) {
    if (terms.some((t) => q.includes(t))) {
      sourceHints.push(key);
      category = "department";
    }
  }

  // Document type detection
  if (/(rulebook|rule|regulation|policy|academic rule)/i.test(q)) {
    sourceHints.push("ugrulebook", "rulebook");
  }
  if (/(course|elective|prerequisite|credit)/i.test(q)) {
    sourceHints.push("resobin", "course");
  }
  if (/(hostel|room|mess|accommodation)/i.test(q)) {
    sourceHints.push("hostel");
  }
  if (/(club|tech|council|fest|mood indigo|techfest)/i.test(q)) {
    sourceHints.push("itc");
    category = "club";
  }
  if (/(damp|mentor|academic guidance)/i.test(q)) {
    sourceHints.push("damp");
  }

  return { sourceHints, category };
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
  limit: number,
  filter?: MetadataFilter
): Promise<RawResult[]> {
  // If we have source hints, do a filtered search first
  if (filter && filter.sourceHints.length > 0) {
    const filterPattern = filter.sourceHints.map((h) => `%${h}%`);
    const { data: filtered } = await sb.rpc("search_chunks", {
      query_embedding: embedding,
      match_count: limit,
      similarity_threshold: 0.25,
    });

    // Client-side filter (since Supabase RPC doesn't support ILIKE in vector search)
    const filteredResults = (filtered || []).filter((r: any) => {
      const src = (r.source || "").toLowerCase();
      const meta = JSON.stringify(r.metadata || {}).toLowerCase();
      return filter.sourceHints.some((h) => src.includes(h) || meta.includes(h));
    });

    // If we found enough filtered results, use them; otherwise fall back to unfiltered
    if (filteredResults.length >= 3) {
      return filteredResults.slice(0, limit);
    }
  }

  // Unfiltered search
  const { data } = await sb.rpc("search_chunks", {
    query_embedding: embedding,
    match_count: limit,
    similarity_threshold: 0.35,
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

// ─── Cross-Encoder Re-ranking (no LLM, pure heuristic) ───

function crossEncoderRerank(sources: Source[], query: string, limit: number): Source[] {
  const queryTerms = query.toLowerCase().split(/\s+/).filter((t) => t.length > 2);
  const queryBigrams = getBigrams(query.toLowerCase());

  return sources
    .map((source) => {
      const content = source.content_snippet.toLowerCase();
      let boost = 0;

      // 1. Term overlap score (what % of query terms appear)
      const matchedTerms = queryTerms.filter((t) => content.includes(t));
      const termOverlap = matchedTerms.length / Math.max(queryTerms.length, 1);
      boost += termOverlap * 0.25;

      // 2. Bigram overlap (consecutive word pairs — catches phrases)
      const contentBigrams = getBigrams(content);
      const bigramOverlap = queryBigrams.filter((b) => contentBigrams.includes(b)).length;
      boost += Math.min(bigramOverlap * 0.05, 0.2);

      // 3. Position weighting — terms appearing early in chunk score higher
      for (const term of queryTerms) {
        const pos = content.indexOf(term);
        if (pos >= 0 && pos < 200) {
          boost += 0.03; // Early mention bonus
        }
      }

      // 4. Exact phrase match bonus
      if (content.includes(query.toLowerCase())) {
        boost += 0.3;
      }

      // 5. Length penalty — very long chunks are likely less focused
      if (content.length > 2000) {
        boost -= 0.05;
      }

      // 6. Source hint bonus — if title matches query keywords
      const title = (source.title || "").toLowerCase();
      const titleMatch = queryTerms.filter((t) => title.includes(t)).length;
      boost += titleMatch * 0.08;

      return {
        ...source,
        relevance_score: source.relevance_score + boost,
      };
    })
    .sort((a, b) => b.relevance_score - a.relevance_score)
    .slice(0, limit);
}

function getBigrams(text: string): string[] {
  const words = text.split(/\s+/).filter((w) => w.length > 2);
  const bigrams: string[] = [];
  for (let i = 0; i < words.length - 1; i++) {
    bigrams.push(`${words[i]} ${words[i + 1]}`);
  }
  return bigrams;
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
      title: formatSourceTitle(r.source, r.metadata),
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
      title: formatSourceTitle(r.source, r.metadata),
      content_snippet: r.content,
      source_type: "document",
      metadata: r.metadata,
      relevance_score: 0.3 * r.similarity,
    });
  }

  return sources.sort((a, b) => b.relevance_score - a.relevance_score).slice(0, limit);
}

// ─── Source title formatting ───

function formatSourceTitle(rawSource: string, metadata: Record<string, unknown>): string {
  // Prefer display_name from metadata (set during embedding pipeline)
  if (metadata?.display_name && typeof metadata.display_name === "string") {
    const section = metadata?.section as string | undefined;
    return section ? `${metadata.display_name} (${section})` : metadata.display_name;
  }

  // Fallback: derive a readable title from the raw source string
  const section = metadata?.section as string | undefined;
  const page = metadata?.page as number | undefined;
  const category = metadata?.category as string | undefined;

  let title = rawSource
    .replace(/\.[^/.]+$/, "")           // Remove file extension
    .replace(/^.*[/\\]/, "")            // Remove path prefix
    .replace(/[_-]+/g, " ")            // Replace separators with spaces
    .trim();

  // Split known compound words that come in without separators
  title = title
    .replace(/ugrulebook/i, "UG Rulebook")
    .replace(/resobin/i, "Resobin");

  // Title case, but preserve known acronyms
  title = title.replace(/\b\w+/g, (word) => {
    const upper = word.toUpperCase();
    const acronyms = ["IIT", "IITB", "CSE", "EE", "UG", "PG", "CPI", "SPI", "DAMP", "SAC", "ITC", "HASMED"];
    if (acronyms.includes(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1);
  });

  if (section) {
    title = `${title} (${section})`;
  } else if (category) {
    title = `${title} (${category})`;
  }

  if (page) {
    title += ` p.${page}`;
  }

  return title;
}
