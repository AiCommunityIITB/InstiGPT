-- Migration 005: Stricter vector search threshold
-- Increases default similarity threshold from 0.3 to 0.35 to reduce garbage results.
-- The previous threshold was too permissive, letting irrelevant chunks through
-- that confused the LLM and wasted tokens.

CREATE OR REPLACE FUNCTION search_chunks(
    query_embedding vector(768),
    match_count INT DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.35
)
RETURNS TABLE (
    id UUID,
    content TEXT,
    source TEXT,
    metadata JSONB,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        c.id,
        c.content,
        c.source,
        c.metadata,
        1 - (c.embedding <=> query_embedding) AS similarity
    FROM chunks c
    WHERE 1 - (c.embedding <=> query_embedding) > similarity_threshold
    ORDER BY c.embedding <=> query_embedding
    LIMIT match_count;
$$;
