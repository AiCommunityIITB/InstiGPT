-- InstiGPT v2 Database Schema
-- Supabase Postgres + pgvector + knowledge graph

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm; -- for fuzzy text search

-- ============ Users & Auth ============

CREATE TABLE users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT,
    roll_number TEXT,
    department TEXT,
    year INTEGER,
    program TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON sessions(user_id);
CREATE INDEX idx_sessions_expires ON sessions(expires_at);

-- ============ Conversations & Messages ============

CREATE TABLE conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL DEFAULT 'New conversation',
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_conversations_user ON conversations(user_id);

CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
    content TEXT NOT NULL,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sources JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_messages_conversation ON messages(conversation_id);

-- ============ Knowledge Base: Document Chunks ============

CREATE TABLE chunks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    content TEXT NOT NULL,
    source TEXT NOT NULL, -- document name: 'ug_rulebook', 'resobin', etc.
    metadata JSONB DEFAULT '{}',
    embedding vector(768), -- BGE base produces 768-dim vectors
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- HNSW index for fast approximate nearest neighbor search
CREATE INDEX idx_chunks_embedding ON chunks
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Full-text search index
ALTER TABLE chunks ADD COLUMN fts tsvector
    GENERATED ALWAYS AS (to_tsvector('english', content)) STORED;
CREATE INDEX idx_chunks_fts ON chunks USING gin(fts);

-- Trigram index for fuzzy matching
CREATE INDEX idx_chunks_content_trgm ON chunks USING gin(content gin_trgm_ops);

-- ============ Knowledge Graph ============

CREATE TABLE entities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT NOT NULL CHECK (type IN (
        'course', 'professor', 'department', 'hostel', 'club', 'event', 'facility', 'policy'
    )),
    name TEXT NOT NULL,
    metadata JSONB DEFAULT '{}',
    embedding vector(768),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_entities_type ON entities(type);
CREATE INDEX idx_entities_name_trgm ON entities USING gin(name gin_trgm_ops);
CREATE INDEX idx_entities_embedding ON entities
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);

-- Full-text search on entity names and metadata
ALTER TABLE entities ADD COLUMN fts tsvector
    GENERATED ALWAYS AS (
        to_tsvector('english', name || ' ' || COALESCE(metadata->>'description', ''))
    ) STORED;
CREATE INDEX idx_entities_fts ON entities USING gin(fts);

CREATE TABLE relationships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    target_id UUID NOT NULL REFERENCES entities(id) ON DELETE CASCADE,
    relation TEXT NOT NULL CHECK (relation IN (
        'teaches', 'prerequisite_of', 'belongs_to', 'located_in', 'part_of', 'related_to'
    )),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_relationships_source ON relationships(source_id);
CREATE INDEX idx_relationships_target ON relationships(target_id);
CREATE INDEX idx_relationships_relation ON relationships(relation);

-- Unique constraint to prevent duplicate relationships
CREATE UNIQUE INDEX idx_relationships_unique
    ON relationships(source_id, target_id, relation);

-- ============ Functions for Search ============

-- Vector similarity search for chunks
CREATE OR REPLACE FUNCTION search_chunks(
    query_embedding vector(768),
    match_count INT DEFAULT 10,
    similarity_threshold FLOAT DEFAULT 0.3
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

-- Keyword/full-text search for chunks
CREATE OR REPLACE FUNCTION keyword_search_chunks(
    search_query TEXT,
    match_count INT DEFAULT 10
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
        ts_rank(c.fts, websearch_to_tsquery('english', search_query))::FLOAT AS similarity
    FROM chunks c
    WHERE c.fts @@ websearch_to_tsquery('english', search_query)
    ORDER BY similarity DESC
    LIMIT match_count;
$$;

-- Entity search (fuzzy name matching + full text)
CREATE OR REPLACE FUNCTION search_entities(
    search_query TEXT,
    match_count INT DEFAULT 5
)
RETURNS TABLE (
    id UUID,
    name TEXT,
    type TEXT,
    metadata JSONB,
    relations JSONB
)
LANGUAGE sql STABLE
AS $$
    SELECT
        e.id,
        e.name,
        e.type,
        e.metadata,
        COALESCE(
            (
                SELECT jsonb_agg(jsonb_build_object(
                    'relation', r.relation,
                    'target_name', t.name,
                    'target_type', t.type,
                    'target_metadata', t.metadata
                ))
                FROM relationships r
                JOIN entities t ON r.target_id = t.id
                WHERE r.source_id = e.id
            ),
            '[]'::jsonb
        ) AS relations
    FROM entities e
    WHERE
        e.fts @@ websearch_to_tsquery('english', search_query)
        OR e.name ILIKE '%' || search_query || '%'
        OR similarity(e.name, search_query) > 0.3
    ORDER BY
        CASE
            WHEN e.name ILIKE '%' || search_query || '%' THEN 0
            ELSE 1
        END,
        similarity(e.name, search_query) DESC
    LIMIT match_count;
$$;

-- ============ RLS Policies ============

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Users can only access their own conversations
CREATE POLICY conversations_user_policy ON conversations
    FOR ALL USING (user_id = current_setting('app.current_user_id', true));

-- Users can only access messages in their own conversations
CREATE POLICY messages_user_policy ON messages
    FOR ALL USING (
        conversation_id IN (
            SELECT id FROM conversations
            WHERE user_id = current_setting('app.current_user_id', true)
        )
    );
