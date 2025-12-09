-- Migration: RAG embeddings + semantic search RPC
-- Purpose:
--   Provide a thin pgvector-based table + RPC that RAGService can use
--   for true vector similarity, without changing existing flows.
--   Embedding generation/population can be wired up later (Dagster job, trigger, etc.).

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Generic embedding table for expert/rule/prior/template knowledge
CREATE TABLE IF NOT EXISTS rag_knowledge_embeddings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- What this vector represents
    object_type TEXT NOT NULL,           -- 'prior', 'rule', 'template', 'scenario', etc.
    object_table TEXT NOT NULL,          -- e.g. 'population_priors', 'expert_rules'
    object_id TEXT NOT NULL,             -- underlying row id (uuid::text or composite key)

    -- Text used to build the embedding (for inspection/debugging)
    content TEXT NOT NULL,

    -- Vector embedding (1536 dims is a common choice; adjust if needed)
    embedding VECTOR(1536) NOT NULL,

    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Basic index for vector similarity. You may want to REINDEX with a larger lists value
-- once the table has enough rows:
--   CREATE INDEX ON rag_knowledge_embeddings USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
CREATE INDEX IF NOT EXISTS rag_embeddings_l2_idx
ON rag_knowledge_embeddings
USING ivfflat (embedding vector_l2_ops)
WITH (lists = 50);

-- Simple semantic search RPC using pgvector distance
CREATE OR REPLACE FUNCTION rag_search_knowledge(
    query_embedding VECTOR(1536),
    match_types TEXT[] DEFAULT NULL,
    match_limit INT DEFAULT 20
)
RETURNS TABLE (
    id UUID,
    object_type TEXT,
    object_table TEXT,
    object_id TEXT,
    content TEXT,
    similarity REAL
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        e.id,
        e.object_type,
        e.object_table,
        e.object_id,
        e.content,
        1 - (e.embedding <=> query_embedding) AS similarity  -- cosine similarity-ish (if using cosine_ops)
    FROM rag_knowledge_embeddings e
    WHERE match_types IS NULL OR e.object_type = ANY (match_types)
    ORDER BY e.embedding <=> query_embedding
    LIMIT match_limit;
END;
$$;

-- Optional: RLS can be added later; for now this table is intended to hold
-- non-PII expert/priors/template content only.


