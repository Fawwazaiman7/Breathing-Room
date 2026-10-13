#!/usr/bin/env node
/**
 * Loads the Support Chat data into Supabase:
 *   kb/knowledge-base.json  -> public.kb_passages
 *   kb/intent-examples.json -> public.kb_intent_examples (training examples)
 * and creates an embedding for every row with the Gemini API.
 *
 * kb/intent-test-set.json is deliberately not loaded: the test questions
 * must never vote, so that kb/evaluate-chat.mjs measures the chatbot on
 * questions it has not seen. See kb/INTENTS.md.
 *
 * Usage, from the backend folder:
 *   node kb/index-kb.mjs            only new or changed rows are embedded
 *   node kb/index-kb.mjs --force    every row is embedded again
 *
 * Before the first run:
 *   1. Run 004_support_chat.sql in the Supabase SQL Editor.
 *   2. Put GEMINI_API_KEY in backend/.env.
 *   3. Start the backend once (npm run start:dev) so dist/ exists.
 *
 * Run it again whenever a passage or an example changes, and with --force
 * after changing GEMINI_EMBEDDING_MODEL. Rows that are no longer in the
 * JSON files are removed from the database.
 */
import { createHash } from 'node:crypto';
import {
  fail,
  loadCompiled,
  openSupabase,
  readEnv,
  readJson,
  requireEnv,
  sleep,
  withRetry,
} from './_shared.mjs';

const force = process.argv.includes('--force');
const env = readEnv();
requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']);

const gemini = await loadCompiled('chat/gemini.request.js');
const { INTENT_LABELS, isChatIntent } = await loadCompiled('chat/chat.types.js');
const model = env.GEMINI_EMBEDDING_MODEL || gemini.DEFAULT_GEMINI_EMBEDDING_MODEL;
const supabase = await openSupabase(env);

const passages = readJson('knowledge-base.json').passages;
const examples = readJson('intent-examples.json').examples;

for (const passage of passages) {
  if (!isChatIntent(passage.topic)) fail(`Passage ${passage.id} has an unknown topic: ${passage.topic}`);
  if (/\[[^\]]*\]/.test(passage.text)) fail(`Passage ${passage.id} still contains a [placeholder]. Fill it in before indexing.`);
}
const testTexts = new Set(readJson('intent-test-set.json').examples.map((e) => e.text.trim().toLowerCase()));
for (const example of examples) {
  if (!isChatIntent(example.intent)) fail(`Example ${example.id} has an unknown intent: ${example.intent}`);
  if (testTexts.has(example.text.trim().toLowerCase())) {
    fail(`Example ${example.id} is also a question of the test set (kb/intent-test-set.json). Remove it from one of the two files.`);
  }
}

const hashOf = (...parts) =>
  createHash('sha256').update([model, ...parts].join('\u0001')).digest('hex');

async function sync({ table, rows, toRow, label }) {
  const { data: existing, error } = await supabase.from(table).select('id, content_hash');
  if (error) {
    fail(
      `Could not read ${table}: ${error.message}\n` +
        'Has 004_support_chat.sql been run in the Supabase SQL Editor?',
    );
  }
  const stored = new Map(existing.map((row) => [row.id, row.content_hash]));
  const wanted = new Set(rows.map((row) => row.id));
  let embedded = 0;
  let unchanged = 0;

  for (const row of rows) {
    const prepared = toRow(row);
    if (!force && stored.get(row.id) === prepared.content_hash) {
      unchanged += 1;
      continue;
    }
    const values = await withRetry(
      () =>
        gemini.requestGeminiEmbedding({
          apiKey: env.GEMINI_API_KEY,
          model,
          text: prepared.embedText,
          kind: prepared.embedKind,
          title: prepared.embedTitle,
        }),
      row.id,
    );
    const { embedText, embedKind, embedTitle, ...columns } = prepared;
    const { error: writeError } = await supabase.from(table).upsert({
      ...columns,
      embedding_model: model,
      embedding: JSON.stringify(values),
      updated_at: new Date().toISOString(),
    });
    if (writeError) fail(`Could not save ${row.id} to ${table}: ${writeError.message}`);
    embedded += 1;
    process.stdout.write(`  ${label} ${row.id} embedded\n`);
    await sleep(250); // stay well inside the free tier's request rate
  }

  const stale = [...stored.keys()].filter((id) => !wanted.has(id));
  if (stale.length > 0) {
    const { error: deleteError } = await supabase.from(table).delete().in('id', stale);
    if (deleteError) fail(`Could not remove old rows from ${table}: ${deleteError.message}`);
  }
  console.log(
    `${table}: ${embedded} embedded, ${unchanged} unchanged, ${stale.length} removed, ${rows.length} total.`,
  );
}

console.log(`Embedding model: ${model}${force ? ' (forced re-index)' : ''}\n`);

await sync({
  table: 'kb_passages',
  label: 'passage',
  rows: passages,
  toRow: (p) => ({
    id: p.id,
    topic: p.topic,
    content: p.text,
    source: p.source ?? '',
    status: p.status ?? 'draft',
    content_hash: hashOf('document', p.topic, p.text),
    embedText: p.text,
    embedKind: 'document',
    embedTitle: INTENT_LABELS[p.topic],
  }),
});

await sync({
  table: 'kb_intent_examples',
  label: 'example',
  rows: examples,
  toRow: (e) => ({
    id: e.id,
    intent: e.intent,
    utterance: e.text,
    content_hash: hashOf('query', e.intent, e.text),
    // Examples are questions, so they are embedded the way questions are.
    embedText: e.text,
    embedKind: 'query',
    embedTitle: undefined,
  }),
});

console.log('\nDone. The Support Chat reads the new data within five minutes, or at once after a backend restart.');
