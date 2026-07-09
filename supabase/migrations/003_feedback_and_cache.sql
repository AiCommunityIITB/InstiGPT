-- Feedback table for message ratings
CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    message_id UUID NOT NULL,
    conversation_id UUID NOT NULL,
    user_id TEXT NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('positive', 'negative')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_feedback_message ON feedback(message_id);
CREATE INDEX idx_feedback_conversation ON feedback(conversation_id);
CREATE INDEX idx_feedback_user ON feedback(user_id);

-- Semantic cache table for caching RAG responses
CREATE TABLE semantic_cache (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    query_embedding vector(768),
    query_text TEXT NOT NULL,
    response TEXT NOT NULL,
    sources JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

-- HNSW index for fast semantic similarity search on cache
CREATE INDEX idx_semantic_cache_embedding ON semantic_cache
    USING hnsw (query_embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Function to search the semantic cache
CREATE OR REPLACE FUNCTION search_cache(
    query_embedding vector(768),
    similarity_threshold FLOAT DEFAULT 0.95
)
RETURNS TABLE (
    id UUID,
    query_text TEXT,
    response TEXT,
    sources JSONB,
    similarity FLOAT
)
LANGUAGE sql STABLE
AS $$
    SELECT
        sc.id,
        sc.query_text,
        sc.response,
        sc.sources,
        1 - (sc.query_embedding <=> query_embedding) AS similarity
    FROM semantic_cache sc
    WHERE 1 - (sc.query_embedding <=> query_embedding) > similarity_threshold
        AND (sc.expires_at IS NULL OR sc.expires_at > NOW())
    ORDER BY sc.query_embedding <=> query_embedding
    LIMIT 1;
$$;
