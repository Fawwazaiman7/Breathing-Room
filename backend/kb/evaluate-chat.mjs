#!/usr/bin/env node
/**
 * Measures how well the Support Chat recognises intents and finds passages.
 *
 * Usage, from the backend folder (after "node kb/index-kb.mjs"):
 *   node kb/evaluate-chat.mjs
 *
 * The data
 *   Training examples  kb/intent-examples.json, stored in the database. They
 *                      vote, together with the knowledge base passages.
 *   Test set           kb/intent-test-set.json, the 30 utterances of the
 *                      thesis dataset. Never stored, never vote.
 *
 * What it reports
 *   1. Intent recognition on the test set, with the method the server uses:
 *      a keyword rule when one applies (kb/INTENTS.md), otherwise the vote.
 *      A training example that is nearly the same sentence as the test
 *      question being classified is left out of that vote. Two figures are
 *      given: strict (the original label only) and relaxed (the original
 *      label, or the second label of a question marked as belonging to
 *      two intents in the test set file).
 *   2. Retrieval for the test set: whether the closest passage, and the
 *      passages handed to the language model, come from the expected topic.
 *   3. The same intent test with other ways of voting, for comparison.
 *   4. Which training examples were left out as near-duplicates.
 *   5. Leave-one-out on the training examples themselves (a consistency
 *      check of the examples, not the headline figure).
 *   6. Extra questions: Indonesian, off-topic, campus questions outside the
 *      knowledge base, and follow-ups that mean nothing on their own.
 *   7. Advice on CHAT_MIN_SIMILARITY.
 *   8. The hold-out set, when kb/intent-holdout-set.json exists: questions
 *      written after the rules and examples were frozen, classified once.
 *      This is the figure that says how the chatbot does on new questions.
 *
 * Results are written to kb/chat-evaluation.csv and kb/chat-neighbours.json.
 * Neither contains student data. Embeddings of the test set and the extra
 * questions are kept in kb/.embedding-cache.json, so only the first run
 * calls the Gemini API (about 55 requests). No Groq requests are made.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  fail,
  here,
  loadCompiled,
  openSupabase,
  parseVector,
  readEnv,
  readJson,
  requireEnv,
  sleep,
  withRetry,
} from './_shared.mjs';

const env = readEnv();
requireEnv(env, ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY', 'GEMINI_API_KEY']);
const gemini = await loadCompiled('chat/gemini.request.js');
const { classifyWithPassages, cosineSimilarity, voteIntent, DEFAULT_INTENT_K } = await loadCompiled('chat/chat.intent.js');
const { selectPassages, MAX_CONTEXT_PASSAGES } = await loadCompiled('chat/chat.retrieval.js');
const { matchIntentRule, INTENT_RULES } = await loadCompiled('chat/chat.intent-rules.js');
const { CHAT_INTENTS, isChatIntent } = await loadCompiled('chat/chat.types.js');
if (typeof voteIntent !== 'function' || typeof classifyWithPassages !== 'function' || typeof matchIntentRule !== 'function') {
  fail('The compiled backend code is older than this script. Start the backend once with "npm run start:dev" (or run "npm run build"), then try again.');
}
const model = env.GEMINI_EMBEDDING_MODEL || gemini.DEFAULT_GEMINI_EMBEDDING_MODEL;
const supabase = await openSupabase(env);

/** At or above this similarity two questions count as the same sentence. */
const DUPLICATE_SIMILARITY = 0.88;
const CANDIDATES = 8; // what the server asks the database for

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------
async function readTable(table, columns) {
  const { data, error } = await supabase.from(table).select(columns).order('id');
  if (error) fail(`Could not read ${table}: ${error.message}`);
  if (!data || data.length === 0) fail(`${table} is empty. Run "node kb/index-kb.mjs" first.`);
  return data.map((row) => ({ ...row, embedding: parseVector(row.embedding) }));
}
const training = await readTable('kb_intent_examples', 'id, intent, utterance, embedding');
const passages = await readTable('kb_passages', 'id, topic, embedding');

const trainingFile = readJson('intent-examples.json').examples;
const testSet = readJson('intent-test-set.json').examples;
const kbFile = readJson('knowledge-base.json').passages;
{
  const ids = (rows) => rows.map((row) => row.id).sort().join(' ');
  const stored = ids(training);
  const wanted = ids(trainingFile);
  const storedPassages = ids(passages);
  const wantedPassages = ids(kbFile);
  if (stored !== wanted || storedPassages !== wantedPassages) {
    fail('The database does not hold the same rows as the files in kb/. Run "node kb/index-kb.mjs" first, then run this again.');
  }
  for (const row of testSet) {
    if (!isChatIntent(row.intent)) fail(`Test question ${row.id} has an unknown intent: ${row.intent}`);
    if (row.secondary !== undefined && (!isChatIntent(row.secondary) || row.secondary === row.intent)) {
      fail(`Test question ${row.id} has an unusable second intent: ${row.secondary}`);
    }
    if (trainingFile.some((example) => example.text.trim().toLowerCase() === row.text.trim().toLowerCase())) {
      fail(`Test question ${row.id} is also a training example. The two files must not share a question.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Embeddings of questions that are not in the database, cached on disk
// ---------------------------------------------------------------------------
const cachePath = join(here, '.embedding-cache.json');
let cache = { model, vectors: {} };
if (existsSync(cachePath)) {
  try {
    const saved = JSON.parse(readFileSync(cachePath, 'utf8'));
    if (saved.model === model && saved.vectors) cache = saved;
  } catch {
    // An unreadable cache is simply rebuilt.
  }
}
let requests = 0;
async function embed(id, text) {
  const key = createHash('sha256').update(text).digest('hex');
  if (!cache.vectors[key]) {
    cache.vectors[key] = await withRetry(
      () => gemini.requestGeminiEmbedding({ apiKey: env.GEMINI_API_KEY, model, text, kind: 'query' }),
      id,
    );
    requests += 1;
    await sleep(250);
  }
  return cache.vectors[key];
}

// ---------------------------------------------------------------------------
// Voting
// ---------------------------------------------------------------------------
const byClosest = (a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id);

/** Labelled neighbours of one question, closest first. */
function neighboursOf(embedding, excludeIds) {
  const excluded = new Set(excludeIds);
  return {
    examples: training
      .filter((example) => !excluded.has(example.id))
      .map((example) => ({ id: example.id, intent: example.intent, similarity: cosineSimilarity(embedding, example.embedding) }))
      .sort(byClosest),
    passages: passages
      .map((passage) => ({ id: passage.id, intent: passage.topic, similarity: cosineSimilarity(embedding, passage.embedding) }))
      .sort(byClosest),
  };
}

/** The vote the server uses, run through the server's own function. */
const serverVote = (n, embedding, excludeIds) =>
  classifyWithPassages(
    [embedding],
    training,
    n.passages.slice(0, CANDIDATES).map((p) => ({ id: p.id, topic: p.intent, similarity: p.similarity })),
    { excludeIds },
  );

/** The first is the method the server uses: a keyword rule when one applies, otherwise the vote. */
const METHODS = [
  {
    name: `rules, then vote k=${DEFAULT_INTENT_K} (in use)`,
    pick: (n, embedding, excludeIds, text) => {
      const voted = serverVote(n, embedding, excludeIds);
      const ruled = matchIntentRule(text);
      return ruled ? { ...voted, intent: ruled.intent, rule: ruled.rule, votedIntent: voted.intent } : voted;
    },
  },
  { name: `vote only: examples + passages, k=${DEFAULT_INTENT_K}`, pick: serverVote },
  { name: 'examples + passages, k=3', pick: (n) => voteIntent([...n.examples.slice(0, 3), ...n.passages.slice(0, 3)], 3) },
  { name: 'examples + passages, k=8', pick: (n) => voteIntent([...n.examples.slice(0, 8), ...n.passages.slice(0, 8)], 8) },
  { name: 'examples only, k=5', pick: (n) => voteIntent(n.examples, 5) },
  { name: 'examples only, k=3', pick: (n) => voteIntent(n.examples, 3) },
  { name: 'examples only, k=1', pick: (n) => voteIntent(n.examples, 1) },
  { name: 'passages only, k=5', pick: (n) => voteIntent(n.passages, 5) },
  { name: 'passages only, k=1', pick: (n) => voteIntent(n.passages, 1) },
];

const csv = [['set', 'id', 'text', 'expected_intent', 'also_accepted_intent', 'predicted_intent', 'decided_by', 'vote_alone', 'intent_correct', 'correct_or_also_accepted', 'second_intent_in_vote', 'top_example', 'top_example_similarity', 'top_passage', 'top_passage_topic', 'top_passage_similarity', 'passage_topic_matches', 'passages_given', 'expected_topic_among_given', 'left_out_as_duplicates']];
const cell = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const pct = (n, d) => (d === 0 ? 'n/a' : `${((100 * n) / d).toFixed(1)}%`);
const dump = [];

/**
 * Classifies one question. `selfId` is set for leave-one-out on a training
 * example. `guard` leaves out training examples that are nearly the same
 * sentence as the question.
 */
function evaluate({ set, id, text, expected, secondary = null, embedding, selfId = null, guard = false }) {
  const all = neighboursOf(embedding, selfId ? [selfId] : []);
  const duplicates = guard ? all.examples.filter((n) => n.similarity >= DUPLICATE_SIMILARITY) : [];
  const excludeIds = [...(selfId ? [selfId] : []), ...duplicates.map((n) => n.id)];
  const neighbours = { examples: all.examples.filter((n) => !excludeIds.includes(n.id)), passages: all.passages };

  const results = METHODS.map((method) => method.pick(neighbours, embedding, excludeIds, text));
  const predicted = results.map((result) => result.intent);
  // The two intents with the most weight in the vote of the method in use.
  const weight = new Map();
  for (const voter of results[0].neighbours) {
    weight.set(voter.intent, (weight.get(voter.intent) ?? 0) + Math.max(voter.similarity, 0));
  }
  const topTwo = [predicted[0], ...[...weight.keys()].filter((intent) => intent !== predicted[0]).sort((a, b) => weight.get(b) - weight.get(a))].slice(0, 2);
  const rule = results[0].rule ?? null;
  const votedIntent = results[0].votedIntent ?? predicted[0];

  const candidates = neighbours.passages.slice(0, CANDIDATES).map((p) => ({ id: p.id, topic: p.intent, similarity: p.similarity, content: '' }));
  const given = selectPassages(candidates, predicted[0]);
  const top = neighbours.passages[0];
  const row = {
    set, id, text, expected, secondary,
    predicted: predicted[0],
    rule,
    votedIntent,
    byMethod: predicted,
    topTwo,
    duplicates,
    topExample: neighbours.examples[0],
    topPassage: top,
    given: given.map((p) => p.id),
    topicAmongGiven: expected ? given.some((p) => p.topic === expected) : null,
  };
  csv.push([set, id, text, expected ?? '', secondary ?? '', row.predicted, rule ?? 'vote', votedIntent, expected ? row.predicted === expected : '', expected ? row.predicted === expected || row.predicted === secondary : '', topTwo[1] ?? '', row.topExample.id, row.topExample.similarity.toFixed(4), top.id, top.intent, top.similarity.toFixed(4), expected ? top.intent === expected : '', row.given.join(' '), row.topicAmongGiven ?? '', duplicates.map((n) => `${n.id}:${n.similarity.toFixed(3)}`).join(' ')]);
  dump.push({
    set, id, text, expected: expected ?? null,
    leftOut: duplicates.map((n) => n.id),
    examples: neighbours.examples.slice(0, 8).map((n) => ({ ...n, similarity: Number(n.similarity.toFixed(4)) })),
    passages: neighbours.passages.slice(0, 8).map((n) => ({ ...n, similarity: Number(n.similarity.toFixed(4)) })),
  });
  return row;
}

function tally(rows) {
  const perIntent = Object.fromEntries(CHAT_INTENTS.map((intent) => [intent, { total: 0, intent: 0, top: 0, given: 0 }]));
  const confusion = Object.fromEntries(CHAT_INTENTS.map((a) => [a, Object.fromEntries(CHAT_INTENTS.map((b) => [b, 0]))]));
  let withinTwo = 0;
  for (const row of rows) {
    const t = perIntent[row.expected];
    t.total += 1;
    t.intent += row.predicted === row.expected ? 1 : 0;
    t.top += row.topPassage.intent === row.expected ? 1 : 0;
    t.given += row.topicAmongGiven ? 1 : 0;
    confusion[row.expected][row.predicted] += 1;
    withinTwo += row.topTwo.includes(row.expected) ? 1 : 0;
  }
  const sum = (key) => CHAT_INTENTS.reduce((total, intent) => total + perIntent[intent][key], 0);
  return { perIntent, confusion, withinTwo, sum };
}

// ---------------------------------------------------------------------------
// The database search must agree with the local calculation used below.
// ---------------------------------------------------------------------------
{
  const { data: rows, error: rpcError } = await supabase.rpc('match_kb_passages', {
    query_embedding: JSON.stringify(training[0].embedding),
    match_count: 1,
  });
  if (rpcError) fail(`Knowledge base search failed: ${rpcError.message}`);
  const local = neighboursOf(training[0].embedding, []).passages[0];
  const same = rows?.[0]?.id === local.id && Math.abs(Number(rows[0].similarity) - local.similarity) < 0.001;
  console.log(`Embedding model: ${model}`);
  console.log(`Data: ${training.length} training examples and ${passages.length} passages in the database, ${testSet.length} test questions in kb/intent-test-set.json`);
  console.log(`Database search ${same ? 'agrees' : 'DOES NOT AGREE'} with the local calculation (${rows?.[0]?.id} ${Number(rows?.[0]?.similarity).toFixed(4)} / ${local.id} ${local.similarity.toFixed(4)})`);
}

// ---------------------------------------------------------------------------
// Embed everything that is not in the database
// ---------------------------------------------------------------------------
const probes = [
  { set: 'indonesian', id: 'ID-1', expected: 'BURNOUT_INFO', text: 'Apa itu burnout akademik dan apa saja tandanya?' },
  { set: 'indonesian', id: 'ID-2', expected: 'WORKLOAD', text: 'Tugas kuliah saya menumpuk dan rasanya berat sekali.' },
  { set: 'indonesian', id: 'ID-3', expected: 'EXHAUSTION_DISENGAGEMENT', text: 'Kenapa saya merasa capek terus dan tidak peduli lagi dengan kuliah?' },
  { set: 'indonesian', id: 'ID-4', expected: 'TIME_MANAGEMENT', text: 'Bagaimana cara berhenti menunda-nunda tugas?' },
  { set: 'indonesian', id: 'ID-5', expected: 'SCREENING_RESULT', text: 'Hasil skrining saya risiko tinggi, itu artinya apa?' },
  { set: 'indonesian', id: 'ID-6', expected: 'STUDENT_SUPPORT', text: 'Bagaimana cara mendaftar konseling di kampus?' },
  { set: 'indonesian', id: 'ID-7', expected: 'BURNOUT_INFO', text: 'burnout itu sama kayak stres biasa ga sih?' },
  { set: 'indonesian', id: 'ID-8', expected: 'WORKLOAD', text: 'proyek PBL lagi banyak banget, pusing' },
  { set: 'indonesian', id: 'ID-9', expected: 'EXHAUSTION_DISENGAGEMENT', text: 'udah males banget kuliah, rasanya hampa' },
  { set: 'indonesian', id: 'ID-10', expected: 'TIME_MANAGEMENT', text: 'gimana cara bagi waktu antara tugas dan istirahat?' },
  { set: 'indonesian', id: 'ID-11', expected: 'SCREENING_RESULT', text: 'apakah hasil skrining saya bisa berubah?' },
  { set: 'indonesian', id: 'ID-12', expected: 'STUDENT_SUPPORT', text: 'konseling di PNJ bayar ga?' },
  { set: 'off_topic', id: 'OFF-1', text: 'What is the capital of France?' },
  { set: 'off_topic', id: 'OFF-2', text: 'Bagaimana cara membuat nasi goreng?' },
  { set: 'off_topic', id: 'OFF-3', text: 'Who won the last football world cup?' },
  { set: 'off_topic', id: 'OFF-4', text: 'berapa 2 + 2' },
  { set: 'off_topic', id: 'OFF-5', text: 'Write a Python function that sorts a list.' },
  { set: 'off_topic', id: 'OFF-6', text: 'Siapa presiden Indonesia sekarang?' },
  { set: 'off_topic', id: 'OFF-7', text: 'Rekomendasi film yang bagus dong' },
  { set: 'off_topic', id: 'OFF-8', text: 'How do I install NestJS?' },
  { set: 'near_topic', id: 'NEAR-1', text: 'Bagaimana cara mendaftar beasiswa di PNJ?' },
  { set: 'near_topic', id: 'NEAR-2', text: 'Kapan batas pembayaran UKT semester ini?' },
  { set: 'follow_up', id: 'FOL-1', text: 'Can you explain that more?' },
  { set: 'follow_up', id: 'FOL-2', text: 'Maksudnya gimana?' },
  { set: 'follow_up', id: 'FOL-3', text: 'Contohnya apa?' },
];
for (const row of [...testSet, ...probes]) {
  row.embedding = await embed(row.id, row.text);
}
writeFileSync(cachePath, JSON.stringify(cache));
console.log(`Gemini requests made in this run: ${requests} (the rest came from kb/.embedding-cache.json)\n`);

// ---------------------------------------------------------------------------
// 1 and 2: the test set
// ---------------------------------------------------------------------------
const scores = METHODS.map(() => ({ test: 0, relaxed: 0, probes: 0 }));
const testRows = testSet.map((row) =>
  evaluate({ set: 'test', id: row.id, text: row.text, expected: row.intent, secondary: row.secondary ?? null, embedding: row.embedding, guard: true }),
);
console.log('1. Intent recognition on the test set (questions the chatbot has never seen)\n');
const twoIntent = testRows.filter((row) => row.secondary);
for (const row of testRows) {
  const ok = row.predicted === row.expected;
  const also = !ok && row.predicted === row.secondary;
  row.byMethod.forEach((intent, i) => {
    scores[i].test += intent === row.expected ? 1 : 0;
    scores[i].relaxed += intent === row.expected || intent === row.secondary ? 1 : 0;
  });
  console.log(`  ${ok ? 'ok  ' : also ? 'ok2 ' : 'MISS'} ${row.id} ${row.expected.padEnd(25)} -> ${String(row.predicted).padEnd(25)} ${(row.rule ?? 'vote').padEnd(15)} ${row.text}`);
}
const test = tally(testRows);
console.log(`\n  Strict accuracy (original label only):            ${scores[0].test}/${testRows.length} (${pct(scores[0].test, testRows.length)})`);
console.log(`  Relaxed accuracy (original or second label):      ${scores[0].relaxed}/${testRows.length} (${pct(scores[0].relaxed, testRows.length)})`);
console.log(`  Original label is one of the two strongest votes: ${test.withinTwo}/${testRows.length} (${pct(test.withinTwo, testRows.length)})`);
const byRule = testRows.filter((row) => row.rule);
const byVote = testRows.filter((row) => !row.rule);
const right = (rows) => rows.filter((row) => row.predicted === row.expected).length;
console.log(`\n  Decided by a keyword rule: ${byRule.length} questions, ${right(byRule)} correct. Decided by the vote: ${byVote.length} questions, ${right(byVote)} correct (strict).`);
const changed = byRule.filter((row) => row.votedIntent !== row.predicted);
console.log(`  Rules that overruled the vote: ${changed.map((row) => `${row.id} ${row.rule} (vote said ${row.votedIntent})`).join(', ') || 'none'}.`);
console.log('  The rules, in the order they are checked (the first match wins):');
for (const rule of INTENT_RULES) {
  console.log(`    ${rule.id.padEnd(16)} -> ${rule.intent.padEnd(25)} ${rule.description}`);
}
console.log(`\n  ok2 = the predicted intent is the second label of a question marked as belonging to two intents.`);
console.log(`  ${twoIntent.length} of ${testRows.length} test questions carry a second label: ${twoIntent.map((row) => `${row.id} (+${row.secondary})`).join(', ') || 'none'}.`);
console.log('\n  Confusion matrix, strict (rows = original label, columns = predicted)');
console.log(`  ${''.padEnd(26)}${CHAT_INTENTS.map((i) => i.slice(0, 6).padStart(8)).join('')}`);
for (const expected of CHAT_INTENTS) {
  console.log(`  ${expected.padEnd(26)}${CHAT_INTENTS.map((p) => String(test.confusion[expected][p]).padStart(8)).join('')}`);
}

console.log('\n2. Retrieval for the test set\n');
console.log(`  ${'topic'.padEnd(26)}${'intent'.padStart(8)}${'closest'.padStart(9)}${'given'.padStart(7)}`);
for (const intent of CHAT_INTENTS) {
  const t = test.perIntent[intent];
  console.log(`  ${intent.padEnd(26)}${`${t.intent}/${t.total}`.padStart(8)}${`${t.top}/${t.total}`.padStart(9)}${`${t.given}/${t.total}`.padStart(7)}`);
}
console.log(`\n  closest = the single closest passage is from the expected topic: ${test.sum('top')}/${testRows.length} (${pct(test.sum('top'), testRows.length)})`);
console.log(`  given   = at least one of the ${MAX_CONTEXT_PASSAGES} passages handed to the language model is from the expected topic: ${test.sum('given')}/${testRows.length} (${pct(test.sum('given'), testRows.length)})`);

// ---------------------------------------------------------------------------
// Extra questions (evaluated here so part 3 can include the Indonesian ones)
// ---------------------------------------------------------------------------
const probeRows = probes.map((probe) =>
  evaluate({ set: probe.set, id: probe.id, text: probe.text, expected: probe.expected ?? null, embedding: probe.embedding, guard: true }),
);
const inSet = (name) => probeRows.filter((row) => row.set === name);
const labelled = inSet('indonesian');
for (const row of labelled) {
  row.byMethod.forEach((intent, i) => { scores[i].probes += intent === row.expected ? 1 : 0; });
}

// ---------------------------------------------------------------------------
// 3: other ways of voting
// ---------------------------------------------------------------------------
console.log('\n3. Intent recognition with other ways of voting (same data)\n');
console.log(`  ${'method'.padEnd(36)}${'test, strict'.padStart(14)}${'test, relaxed'.padStart(15)}${`${labelled.length} Indonesian`.padStart(16)}`);
METHODS.forEach((method, i) => {
  console.log(`  ${method.name.padEnd(36)}${`${scores[i].test}/${testRows.length} ${pct(scores[i].test, testRows.length)}`.padStart(14)}${`${scores[i].relaxed}/${testRows.length} ${pct(scores[i].relaxed, testRows.length)}`.padStart(15)}${`${scores[i].probes}/${labelled.length} ${pct(scores[i].probes, labelled.length)}`.padStart(16)}`);
});
console.log('\n  The number of voters (k) is kept at the value chosen before the test set was separated. Picking the');
console.log('  best row of this table would be choosing the method on the very questions it is tested with.');
console.log('  The keyword rules were written after the first evaluation runs, with the missed test questions in');
console.log('  view. The "vote only" row is the figure without them. Questions collected later (user testing) are');
console.log('  the clean check of the rules.');

// ---------------------------------------------------------------------------
// 4: near-duplicates
// ---------------------------------------------------------------------------
console.log(`\n4. Training examples left out as near-duplicates (similarity of ${DUPLICATE_SIMILARITY} or more)\n`);
const flagged = [...testRows, ...labelled].filter((row) => row.duplicates.length > 0);
if (flagged.length === 0) {
  console.log('  None. No training example is nearly the same sentence as a test question.');
} else {
  for (const row of flagged) {
    for (const duplicate of row.duplicates) {
      const example = training.find((item) => item.id === duplicate.id);
      console.log(`  ${row.id} "${row.text}"\n      left out ${duplicate.id} (${duplicate.similarity.toFixed(3)}) "${example.utterance}"`);
    }
  }
  console.log('\n  These examples still help the chatbot in use. They were only kept out of the vote for the question they resemble.');
}

// ---------------------------------------------------------------------------
// 5: leave-one-out on the training examples
// ---------------------------------------------------------------------------
const looRows = training.map((example) =>
  evaluate({ set: 'train_loo', id: example.id, text: example.utterance, expected: example.intent, embedding: example.embedding, selfId: example.id }),
);
const loo = tally(looRows);
console.log('\n5. Leave-one-out on the training examples (each classified with the others)\n');
console.log(`  Decided by a keyword rule: ${looRows.filter((row) => row.rule).length} of ${looRows.length}.`);
console.log(`  Intent accuracy: ${loo.sum('intent')}/${looRows.length} (${pct(loo.sum('intent'), looRows.length)})   ${CHAT_INTENTS.map((intent) => `${intent.slice(0, 6)} ${loo.perIntent[intent].intent}/${loo.perIntent[intent].total}`).join('  ')}`);
for (const row of looRows.filter((item) => item.predicted !== item.expected)) {
  console.log(`  MISS ${row.id} ${row.expected.padEnd(25)} -> ${String(row.predicted).padEnd(25)} ${row.text}`);
}

// ---------------------------------------------------------------------------
// 6: extra questions
// ---------------------------------------------------------------------------
console.log('\n6. Extra questions (not part of either data file)\n');
for (const row of labelled) {
  const ok = row.predicted === row.expected;
  console.log(`  ${ok ? 'ok  ' : 'MISS'} ${row.id.padEnd(6)} ${row.expected.padEnd(25)} -> ${String(row.predicted).padEnd(25)} passage ${row.topPassage.id} (${row.topPassage.similarity.toFixed(3)})  ${row.text}`);
}
console.log(`\n  Indonesian questions recognised: ${labelled.filter((row) => row.predicted === row.expected).length}/${labelled.length}`);
console.log(`  Closest passage from the expected topic: ${labelled.filter((row) => row.topPassage.intent === row.expected).length}/${labelled.length}\n`);
for (const [name, label] of [['off_topic', 'off  '], ['near_topic', 'near '], ['follow_up', 'follow']]) {
  for (const row of inSet(name)) {
    console.log(`  ${label} ${row.id.padEnd(6)} closest passage ${row.topPassage.id} (${row.topPassage.similarity.toFixed(3)})  ${row.text}`);
  }
}

// ---------------------------------------------------------------------------
// 7: the threshold
// ---------------------------------------------------------------------------
const real = [...testRows, ...labelled, ...looRows].map((row) => ({ id: row.id, similarity: row.topPassage.similarity }));
const lowest = [...real].sort((a, b) => a.similarity - b.similarity).slice(0, 5);
const highestOff = inSet('off_topic').reduce((a, b) => (b.topPassage.similarity > a.topPassage.similarity ? b : a));
const configured = Number(env.CHAT_MIN_SIMILARITY);
console.log('\n7. Choosing CHAT_MIN_SIMILARITY (similarity to the closest passage)\n');
console.log(`  Lowest among ${real.length} real questions:  ${lowest.map((item) => `${item.similarity.toFixed(3)} (${item.id})`).join(', ')}`);
console.log(`  Highest among off-topic questions: ${highestOff.topPassage.similarity.toFixed(3)} (${highestOff.id})`);
if (highestOff.topPassage.similarity < lowest[0].similarity) {
  const low = Math.ceil((highestOff.topPassage.similarity + 0.005) * 100) / 100;
  const high = Math.floor((lowest[0].similarity - 0.005) * 100) / 100;
  console.log(`  They do not overlap. Any value from ${low.toFixed(2)} to ${Math.max(low, high).toFixed(2)} separates the two groups in this sample.`);
  console.log('  Prefer the lower end: turning away a real question costs more than passing an off-topic one on,');
  console.log('  because the language model is also instructed to decline what the passages do not cover.');
} else {
  console.log('  The two groups overlap, so no threshold separates them completely. Choose a value just above the');
  console.log('  highest off-topic question only if few real questions fall below it; otherwise leave it unset.');
}
if (Number.isFinite(configured) && configured > 0) {
  const turnedAway = real.filter((item) => item.similarity < configured);
  const passed = inSet('off_topic').filter((row) => row.topPassage.similarity >= configured);
  console.log(`  With the current setting ${configured}: ${turnedAway.length} of ${real.length} real questions would be turned away${turnedAway.length ? ` (${turnedAway.map((item) => item.id).join(', ')})` : ''}, and ${passed.length} of ${inSet('off_topic').length} off-topic questions would pass.`);
} else {
  console.log('  CHAT_MIN_SIMILARITY is not set in backend/.env, so no question is turned away by similarity.');
}
console.log('  "near" questions are about campus life but outside the knowledge base. They pass the threshold; the');
console.log('  language model is instructed to say it has no information on them.');
console.log('  "follow" questions mean nothing on their own, and their closest passages are accidental. The server');
console.log("  reads a message of five words or fewer together with the student's previous question as well.");

// ---------------------------------------------------------------------------
// 8: the hold-out set
// ---------------------------------------------------------------------------
console.log('\n8. Hold-out set (questions written after the rules and examples were frozen)\n');
const holdoutPath = join(here, 'intent-holdout-set.json');
if (!existsSync(holdoutPath)) {
  console.log('  kb/intent-holdout-set.json does not exist yet, so there is nothing to report here.');
  console.log('  The 30 test questions above were used to refine the rules, so their figures describe the');
  console.log('  refinement, not how the chatbot does on new questions. A hold-out set answers that.');
} else {
  const holdout = readJson('intent-holdout-set.json').examples;
  const known = new Set([...trainingFile, ...testSet].map((row) => row.text.trim().toLowerCase()));
  for (const row of holdout) {
    if (!isChatIntent(row.intent)) fail(`Hold-out question ${row.id} has an unknown intent: ${row.intent}`);
    if (known.has(row.text.trim().toLowerCase())) fail(`Hold-out question ${row.id} is already a training example or a test question.`);
    row.embedding = await embed(row.id, row.text);
  }
  writeFileSync(cachePath, JSON.stringify(cache));
  const rows = holdout.map((row) =>
    evaluate({ set: 'holdout', id: row.id, text: row.text, expected: row.intent, embedding: row.embedding, guard: true }),
  );
  for (const row of rows) {
    console.log(`  ${row.predicted === row.expected ? 'ok  ' : 'MISS'} ${row.id.padEnd(4)} ${row.expected.padEnd(25)} -> ${String(row.predicted).padEnd(25)} ${(row.rule ?? 'vote').padEnd(15)} ${row.text}`);
  }
  const held = tally(rows);
  const ruled = rows.filter((row) => row.rule);
  const voted = rows.filter((row) => !row.rule);
  const correct = (list) => list.filter((row) => row.predicted === row.expected).length;
  const voteOnly = rows.filter((row) => row.byMethod[1] === row.expected).length;
  console.log(`\n  Accuracy: ${held.sum('intent')}/${rows.length} (${pct(held.sum('intent'), rows.length)})   ${CHAT_INTENTS.map((intent) => `${intent.slice(0, 6)} ${held.perIntent[intent].intent}/${held.perIntent[intent].total}`).join('  ')}`);
  console.log(`  Original label is one of the two strongest votes: ${held.withinTwo}/${rows.length} (${pct(held.withinTwo, rows.length)})`);
  console.log(`  Decided by a keyword rule: ${ruled.length} questions, ${correct(ruled)} correct. Decided by the vote: ${voted.length} questions, ${correct(voted)} correct.`);
  console.log(`  Without the rules (vote only): ${voteOnly}/${rows.length} (${pct(voteOnly, rows.length)})`);
  console.log(`  Closest passage from the expected topic: ${held.sum('top')}/${rows.length} (${pct(held.sum('top'), rows.length)}); at least one of the ${MAX_CONTEXT_PASSAGES} passages given: ${held.sum('given')}/${rows.length} (${pct(held.sum('given'), rows.length)})`);
  console.log(`  Gemini requests made in this run, all sets together: ${requests}.`);
  console.log('\n  Report this figure as it is. Changing a rule or an example because of a miss here would turn');
  console.log('  this set into development data too, and a new hold-out set would be needed.');
}

writeFileSync(join(here, 'chat-evaluation.csv'), csv.map((row) => row.map(cell).join(',')).join('\n') + '\n');
writeFileSync(join(here, 'chat-neighbours.json'), `${JSON.stringify(dump)}\n`);
console.log('\nSaved kb/chat-evaluation.csv and kb/chat-neighbours.json');
