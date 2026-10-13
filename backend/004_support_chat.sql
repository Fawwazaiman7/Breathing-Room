-- Breathing Room: Support Chat storage (knowledge base + intent examples).
-- Run once in the Supabase SQL Editor, after 001, 002 and 003.
-- Safe to run again.
--
-- What this adds
--   * pgvector, for similarity search over embeddings.
--   * kb_passages: the curated knowledge base, one row per passage.
--   * kb_intent_examples: the labelled example questions used to recognise
--     which of the six topics a student is asking about.
--   * match_kb_passages(): returns the passages closest in meaning to a
--     question.
--
-- The rows themselves are loaded by the backend script kb/index-kb.mjs,
-- which also creates the embeddings. Nothing here stores any conversation:
-- chat messages are not saved in the database.

create extension if not exists vector with schema extensions;

-- Makes the vector type and its operators resolve whether the extension
-- lives in "extensions" (the Supabase default) or in "public".
set search_path = public, extensions;

-- ---------------------------------------------------------------------------
-- Knowledge base passages
-- ---------------------------------------------------------------------------
create table if not exists public.kb_passages (
  id              text primary key,                 -- e.g. 'BI-01'
  topic           text not null check (topic in (
                    'BURNOUT_INFO', 'WORKLOAD', 'EXHAUSTION_DISENGAGEMENT',
                    'TIME_MANAGEMENT', 'SCREENING_RESULT', 'STUDENT_SUPPORT')),
  content         text not null,
  source          text not null default '',
  status          text not null default 'draft',    -- draft | adapted | to_confirm | approved
  content_hash    text not null,                    -- lets the loader skip unchanged rows
  embedding_model text not null,
  embedding       vector(768) not null,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Example questions per intent
-- ---------------------------------------------------------------------------
create table if not exists public.kb_intent_examples (
  id              text primary key,                 -- e.g. 'U01'
  intent          text not null check (intent in (
                    'BURNOUT_INFO', 'WORKLOAD', 'EXHAUSTION_DISENGAGEMENT',
                    'TIME_MANAGEMENT', 'SCREENING_RESULT', 'STUDENT_SUPPORT')),
  utterance       text not null,
  content_hash    text not null,
  embedding_model text not null,
  embedding       vector(768) not null,
  updated_at      timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Access: the browser never reads these tables. Row Level Security is on and
-- no policy is defined, so only the backend (secret key) can use them.
-- ---------------------------------------------------------------------------
alter table public.kb_passages        enable row level security;
alter table public.kb_intent_examples enable row level security;

-- ---------------------------------------------------------------------------
-- Similarity search. Cosine similarity: 1 = same meaning, 0 = unrelated.
-- With a knowledge base this small an exact scan is fast, so no vector index
-- is created.
-- ---------------------------------------------------------------------------
create or replace function public.match_kb_passages(
  query_embedding vector(768),
  match_count     integer default 8
)
returns table (
  id         text,
  topic      text,
  content    text,
  source     text,
  status     text,
  similarity double precision
)
language sql
stable
set search_path = public, extensions
as $$
  select p.id,
         p.topic,
         p.content,
         p.source,
         p.status,
         1 - (p.embedding <=> query_embedding) as similarity
  from public.kb_passages p
  order by p.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20);
$$;

revoke execute on function public.match_kb_passages(vector, integer)
  from public, anon, authenticated;
grant execute on function public.match_kb_passages(vector, integer)
  to service_role;
