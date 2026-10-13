import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ChatMessage } from '../feedback/feedback.prompt.js';
import { checkChatReply } from './chat.checker.js';
import {
  classifyIntent,
  classifyWithPassages,
  cosineSimilarity,
  voteIntent,
} from './chat.intent.js';
import { INTENT_RULES, matchIntentRule } from './chat.intent-rules.js';
import { answerChat, ChatError, mergeMatches } from './chat.logic.js';
import type { ChatDeps } from './chat.logic.js';
import { buildChatMessages, CHAT_SYSTEM_PROMPT } from './chat.prompt.js';
import type { ChatResultContext } from './chat.prompt.js';
import { selectPassages } from './chat.retrieval.js';
import {
  CRISIS_REPLY,
  detectCrisis,
  detectSmallTalk,
  looksIndonesian,
  OUT_OF_SCOPE_REPLY,
  SMALL_TALK_REPLY,
} from './chat.safety.js';
import { CHAT_INTENTS, isChatIntent } from './chat.types.js';
import type { ChatIntent, IntentExample, PassageMatch } from './chat.types.js';
import {
  EMBEDDING_DIMENSIONS,
  formatForEmbedding,
  GeminiError,
  requestGeminiEmbedding,
} from './gemini.request.js';

/* --------------------------------- data --------------------------------- */

const kbDir = join(__dirname, '..', '..', 'kb');
const knowledgeBase = JSON.parse(
  readFileSync(join(kbDir, 'knowledge-base.json'), 'utf8'),
) as { passages: Array<{ id: string; topic: string; status: string; text: string; source: string }> };
const intentExamples = JSON.parse(
  readFileSync(join(kbDir, 'intent-examples.json'), 'utf8'),
) as { examples: Array<{ id: string; intent: string; language: string; text: string }> };
const intentTestSet = JSON.parse(
  readFileSync(join(kbDir, 'intent-test-set.json'), 'utf8'),
) as { examples: Array<{ id: string; intent: string; text: string; secondary?: string; secondaryReason?: string }> };

/** Six axes, one per intent: a toy embedding space for the logic tests. */
function axis(intent: ChatIntent, tilt: Partial<Record<ChatIntent, number>> = {}): number[] {
  return CHAT_INTENTS.map((name) => (name === intent ? 1 : (tilt[name] ?? 0)));
}

const EXAMPLES: IntentExample[] = CHAT_INTENTS.flatMap((intent, i) => [
  { id: `E${i}a`, intent, embedding: axis(intent) },
  { id: `E${i}b`, intent, embedding: axis(intent, { [CHAT_INTENTS[(i + 1) % 6]]: 0.2 }) },
]);

const PASSAGES: PassageMatch[] = [
  { id: 'TM-01', topic: 'TIME_MANAGEMENT', similarity: 0.71, content: 'Putting tasks off can feel like relief now, but it costs more later.' },
  { id: 'WL-05', topic: 'WORKLOAD', similarity: 0.7, content: 'In project-based courses, workload usually peaks near the final milestone.' },
  { id: 'SS-06', topic: 'STUDENT_SUPPORT', similarity: 0.6, content: 'You can message Layanan Psikologis PNJ on WhatsApp at +62 823-7957-4919. The hotline is open Monday to Friday, 08.00 to 16.00 WIB.' },
  { id: 'SS-05', topic: 'STUDENT_SUPPORT', similarity: 0.58, content: 'To register for counselling, fill in the form at https://s.pnj.ac.id/KonselingPNJ.' },
  { id: 'SR-07', topic: 'SCREENING_RESULT', similarity: 0.5, content: 'High risk means extra support is recommended.' },
];

const HIGH_RISK: ChatResultContext = {
  category: 'HIGH_RISK',
  workloadLevel: 'HIGH',
  exhaustionLevel: 'HIGH',
  disengagementLevel: 'LOW',
  interventionLevel: 'CURATIVE',
};

interface Calls {
  embed: string[];
  complete: ChatMessage[][];
  result: string[];
  log: Array<[string, Record<string, unknown>]>;
}

function fakeDeps(
  overrides: Partial<ChatDeps> & { intent?: ChatIntent; replies?: string[] } = {},
): { deps: ChatDeps; calls: Calls } {
  const calls: Calls = { embed: [], complete: [], result: [], log: [] };
  const replies = [...(overrides.replies ?? ['Putting tasks off costs more later, so starting small helps.'])];
  const deps: ChatDeps = {
    embedQuery: async (text) => {
      calls.embed.push(text);
      return axis(overrides.intent ?? 'TIME_MANAGEMENT');
    },
    loadIntentExamples: async () => EXAMPLES,
    matchPassages: async () => PASSAGES,
    latestResult: async (studentId) => {
      calls.result.push(studentId);
      return HIGH_RISK;
    },
    complete: async (messages) => {
      calls.complete.push(messages);
      const next = replies.shift();
      if (next === undefined) {
        throw new Error('no more replies');
      }
      return next;
    },
    log: (event, detail) => calls.log.push([event, detail]),
    ...overrides,
  };
  return { deps, calls };
}

const ask = (deps: ChatDeps, message: string) =>
  answerChat(deps, { studentId: 'student-1', message, history: [] });

/* --------------------------------- tests -------------------------------- */

describe('Support Chat data files', () => {
  it('has a complete, well-formed knowledge base', () => {
    const { passages } = knowledgeBase;
    expect(passages.length).toBeGreaterThanOrEqual(50);
    expect(new Set(passages.map((p) => p.id)).size).toBe(passages.length);
    for (const passage of passages) {
      expect(passage.id).toMatch(/^(BI|WL|ED|TM|SR|SS)-\d{2}$/);
      expect(isChatIntent(passage.topic)).toBe(true);
      expect(['draft', 'adapted', 'to_confirm', 'approved']).toContain(passage.status);
      expect(passage.text.length).toBeGreaterThan(40);
      expect(passage.source.length).toBeGreaterThan(0);
      // An unfilled placeholder must never reach a student.
      expect(passage.text).not.toMatch(/\[[^\]]*\]/);
    }
    for (const intent of CHAT_INTENTS) {
      expect(passages.filter((p) => p.topic === intent).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('has 60 training examples, ten per intent, half English and half Indonesian', () => {
    const { examples } = intentExamples;
    expect(examples).toHaveLength(60);
    expect(new Set(examples.map((e) => e.id)).size).toBe(60);
    expect(new Set(examples.map((e) => e.text.toLowerCase())).size).toBe(60);
    for (const example of examples) {
      expect(example.id).toMatch(/^T\d{2}$/);
      expect(isChatIntent(example.intent)).toBe(true);
      expect(['en', 'id']).toContain(example.language);
      expect(example.text.trim().length).toBeGreaterThan(10);
    }
    for (const intent of CHAT_INTENTS) {
      const ofIntent = examples.filter((e) => e.intent === intent);
      expect(ofIntent).toHaveLength(10);
      expect(ofIntent.filter((e) => e.language === 'id')).toHaveLength(5);
    }
  });

  it('keeps the 30 utterances of the thesis dataset apart as the test set', () => {
    const { examples } = intentTestSet;
    expect(examples).toHaveLength(30);
    expect(examples.map((e) => e.id)).toEqual(Array.from({ length: 30 }, (_, i) => `U${String(i + 1).padStart(2, '0')}`));
    for (const intent of CHAT_INTENTS) {
      expect(examples.filter((e) => e.intent === intent)).toHaveLength(5);
    }
    // A second label is a different, valid intent and comes with its reason.
    for (const example of examples.filter((e) => e.secondary !== undefined)) {
      expect(isChatIntent(example.secondary)).toBe(true);
      expect(example.secondary).not.toBe(example.intent);
      expect((example.secondaryReason ?? '').length).toBeGreaterThan(20);
    }
    // Questions about the Academic Advisor keep a single label.
    expect(examples.filter((e) => /DPA/.test(e.text) && e.secondary !== undefined)).toEqual([]);
    // No question is in both files, so a test question never votes for itself.
    const training = new Set(intentExamples.examples.map((e) => e.text.trim().toLowerCase()));
    expect(examples.filter((e) => training.has(e.text.trim().toLowerCase()))).toEqual([]);
  });
});

describe('Intent recognition', () => {
  it('computes cosine similarity', () => {
    expect(cosineSimilarity([1, 0], [1, 0])).toBeCloseTo(1);
    expect(cosineSimilarity([1, 0], [0, 1])).toBeCloseTo(0);
    expect(cosineSimilarity([1, 0], [-1, 0])).toBeCloseTo(-1);
    expect(cosineSimilarity([3, 4], [6, 8])).toBeCloseTo(1);
    expect(cosineSimilarity([0, 0], [1, 1])).toBe(0);
  });

  it('picks the intent of the closest examples', () => {
    for (const intent of CHAT_INTENTS) {
      const result = classifyIntent(axis(intent), EXAMPLES);
      expect(result.intent).toBe(intent);
      expect(result.neighbours).toHaveLength(5);
      expect(result.topSimilarity).toBeCloseTo(1);
      expect(result.confidence).toBeGreaterThan(0.5);
    }
  });

  it('lets several close examples outvote one closer example', () => {
    const examples: IntentExample[] = [
      { id: 'a', intent: 'WORKLOAD', embedding: [1, 0] },
      { id: 'b', intent: 'TIME_MANAGEMENT', embedding: [0.9, 0.44] },
      { id: 'c', intent: 'TIME_MANAGEMENT', embedding: [0.9, 0.45] },
    ];
    const result = classifyIntent([1, 0.1], examples, { k: 3 });
    expect(result.neighbours[0].id).toBe('a');
    expect(result.intent).toBe('TIME_MANAGEMENT');
  });

  it('gives the same answer whatever order the examples arrive in', () => {
    const query = axis('WORKLOAD', { TIME_MANAGEMENT: 0.9 });
    const forward = classifyIntent(query, EXAMPLES);
    const backward = classifyIntent(query, [...EXAMPLES].reverse());
    expect(backward).toEqual(forward);
  });

  it('returns no intent when nothing is close enough', () => {
    const result = classifyIntent([1, 1, 1, 1, 1, 1], EXAMPLES, { minSimilarity: 0.9 });
    expect(result.intent).toBeNull();
    expect(classifyIntent([1, 1, 1, 1, 1, 1], EXAMPLES).intent).not.toBeNull();
    expect(classifyIntent([1, 0], []).intent).toBeNull();
  });

  it('can leave an example out, for leave-one-out evaluation', () => {
    const result = classifyIntent(EXAMPLES[0].embedding, EXAMPLES, { excludeIds: ['E0a'] });
    expect(result.neighbours.map((n) => n.id)).not.toContain('E0a');
    expect(result.intent).toBe('BURNOUT_INFO');
  });
});

describe('Intent vote with passages', () => {
  const passage = (id: string, topic: ChatIntent, similarity: number) => ({ id, topic, similarity });

  it('lets the closest passages vote together with the closest examples', () => {
    // On the examples alone this question looks like time management...
    const query = axis('TIME_MANAGEMENT', { WORKLOAD: 0.9 });
    expect(classifyIntent(query, EXAMPLES).intent).toBe('TIME_MANAGEMENT');
    // ...but the passages closest to it are all about workload.
    const result = classifyWithPassages([query], EXAMPLES, [
      passage('WL-01', 'WORKLOAD', 0.9),
      passage('WL-02', 'WORKLOAD', 0.88),
      passage('WL-03', 'WORKLOAD', 0.86),
      passage('TM-01', 'TIME_MANAGEMENT', 0.4),
    ]);
    expect(result.intent).toBe('WORKLOAD');
    expect(result.neighbours).toHaveLength(5);
    expect(result.neighbours.map((n) => n.id)).toContain('WL-01');
  });

  it('is the same as the example vote when no passage is given', () => {
    const query = axis('SCREENING_RESULT', { STUDENT_SUPPORT: 0.3 });
    expect(classifyWithPassages([query], EXAMPLES, [])).toEqual(classifyIntent(query, EXAMPLES));
    expect(classifyWithPassages([query], EXAMPLES, [], { k: 1, excludeIds: ['E4a'] }).neighbours[0].id).toBe('E4b');
  });

  it('counts an example with its higher similarity when two readings of the message are given', () => {
    const vague = [1, 1, 1, 1, 1, 1];
    const withPrevious = axis('STUDENT_SUPPORT');
    expect(classifyWithPassages([vague, withPrevious], EXAMPLES, []).intent).toBe('STUDENT_SUPPORT');
    expect(classifyWithPassages([vague, withPrevious], EXAMPLES, []).topSimilarity).toBeCloseTo(1, 5);
  });
});

describe('Intent rules', () => {
  const ruleOf = (text: string) => matchIntentRule(text)?.rule ?? null;

  it('sends anything about the Academic Advisor or counselling to student support', () => {
    expect(matchIntentRule('Can the DPA see my test result?')).toEqual({ rule: 'SS-ADVISOR', intent: 'STUDENT_SUPPORT' });
    expect(ruleOf('How to talk about exhaustion to the DPA?')).toBe('SS-ADVISOR');
    expect(ruleOf('hasil skriningnya bisa dilihat dosen PA?')).toBe('SS-ADVISOR');
    expect(ruleOf('How do I contact my Academic Advisor about this?')).toBe('SS-ADVISOR');
    expect(ruleOf('Saya mau ikut konseling')).toBe('SS-COUNSELLING');
    expect(ruleOf('Is what I say in counselling kept confidential?')).toBe('SS-COUNSELLING');
    expect(ruleOf('Di mana lokasi layanan psikologis PNJ?')).toBe('SS-COUNSELLING');
  });

  it('sends privacy questions and concern for someone else to student support', () => {
    expect(ruleOf('Who else can see my answers in this app?')).toBe('SS-PRIVACY');
    expect(ruleOf('Siapa saja yang bisa lihat hasil saya?')).toBe('SS-PRIVACY');
    expect(ruleOf('Is my psychological data safe?')).toBe('SS-PRIVACY');
    expect(ruleOf('Apakah data saya aman?')).toBe('SS-PRIVACY');
    expect(ruleOf('My friend looks burned out, what should I do?')).toBe('SS-SOMEONE-ELSE');
    expect(ruleOf('Teman saya kelihatan burnout, saya harus gimana?')).toBe('SS-SOMEONE-ELSE');
  });

  it('recognises the screening result and the two questionnaires by name', () => {
    expect(matchIntentRule('My result is No Burnout, what does it mean?')).toEqual({ rule: 'SR-CATEGORY', intent: 'SCREENING_RESULT' });
    expect(ruleOf('Hasil saya risiko sedang, apa yang harus saya lakukan?')).toBe('SR-CATEGORY');
    expect(ruleOf('Can my screening result change?')).toBe('SR-CATEGORY');
    expect(matchIntentRule('What does Temporal Demand mean in the questionnaire?')).toEqual({ rule: 'WL-INSTRUMENT', intent: 'WORKLOAD' });
    expect(ruleOf('apa itu nasa tlx')).toBe('WL-INSTRUMENT');
    expect(matchIntentRule('What does a high Disengagement score mean?')).toEqual({ rule: 'ED-INSTRUMENT', intent: 'EXHAUSTION_DISENGAGEMENT' });
    expect(ruleOf('Apa itu OLBI dan apa yang diukurnya?')).toBe('ED-INSTRUMENT');
  });

  it('sends expressed tiredness and named exhaustion to exhaustion and disengagement', () => {
    expect(matchIntentRule('How to recover from mental exhaustion?')).toEqual({ rule: 'ED-STATE', intent: 'EXHAUSTION_DISENGAGEMENT' });
    expect(ruleOf('Why am I so exhausted even with enough sleep?')).toBe('ED-STATE');
    expect(ruleOf('Saya capek banget akhir-akhir ini')).toBe('ED-STATE');
    expect(ruleOf('Why do I feel disengaged from my major?')).toBe('ED-STATE');
    // Another topic is named, so the vote decides what the question is about.
    expect(ruleOf('Is exhaustion a sign of burnout?')).toBeNull();
    expect(ruleOf('Apa bedanya lelah biasa dengan burnout?')).toBeNull();
    expect(ruleOf('Does time management reduce exhaustion?')).toBe('TM-NAMED');
    // Earlier rules still come first.
    expect(ruleOf('How to talk about exhaustion to the DPA?')).toBe('SS-ADVISOR');
    expect(ruleOf('Kenapa hasil saya risiko rendah padahal saya merasa capek?')).toBe('SR-CATEGORY');
  });

  it('follows what the question is about: managing time, or work that is too much', () => {
    expect(matchIntentRule('Does time management prevent burnout?')).toEqual({ rule: 'TM-NAMED', intent: 'TIME_MANAGEMENT' });
    expect(ruleOf('How to divide time between assignments?')).toBe('TM-NAMED');
    expect(ruleOf('gimana ngatur waktu kalau tugas numpuk?')).toBe('TM-NAMED');
    expect(ruleOf('Apakah manajemen waktu bisa mengurangi kelelahan?')).toBe('TM-NAMED');
    expect(matchIntentRule('My PBL projects are piling up, what should I do?')).toEqual({ rule: 'WL-QUANTITY', intent: 'WORKLOAD' });
    expect(ruleOf('Assignments from different courses clash.')).toBe('WL-QUANTITY');
    expect(ruleOf('Tugas kuliah saya menumpuk dan rasanya berat sekali.')).toBe('WL-QUANTITY');
    expect(ruleOf('proyek PBL lagi banyak banget, pusing')).toBe('WL-QUANTITY');
    expect(ruleOf('Tugas basis data saya banyak banget')).toBe('WL-QUANTITY');
    expect(ruleOf('Dosen pembimbing PBL saya kasih tugas banyak banget')).toBe('WL-QUANTITY');
    // Asking how to manage time comes before the pile of work it mentions,
    // and voiced tiredness comes before the amount of work.
    expect(ruleOf('How do I manage my time when assignments pile up?')).toBe('TM-NAMED');
    expect(ruleOf('Tugas banyak banget sampai capek')).toBe('ED-STATE');
    expect(ruleOf('Will my advisor help me with time management?')).toBe('SS-ADVISOR');
  });

  it('leaves everything that is not certain to the vote', () => {
    for (const text of [
      'What is academic burnout and its symptoms?',
      'Are IT students at high risk of burnout?',
      'Apakah mahasiswa IT berisiko tinggi burnout?',
      'My PBL group mates are passive, my time is drained.',
      'I am frustrated, my coding always has errors.',
      'Target IPK saya belum tercapai',
      'Is it okay to take breaks when I have a lot to do?',
      'How do I break a big project into smaller parts?',
      'Saya sering mengerjakan tugas mepet deadline.',
      'Teman saya banyak banget',
      'Too many people in my class',
      'Jadwal kuliah saya bentrok',
      'Does a heavy workload cause burnout?',
      'I procrastinate often.',
      'Waktu saya habis buat organisasi, kuliah jadi keteteran.',
      'Teman kelompok saya pasif semua',
      'teman saya ngajak main terus jadi tugas keteteran',
      'My data structures assignment is too hard',
      'I want to advise my junior about workload',
      'Menurut psikolog, burnout itu apa?',
      'Hasil tes pemrograman saya jelek',
      'Is this result guessed randomly by AI?',
      'I feel drained every day after class.',
      '',
    ]) {
      expect(ruleOf(text)).toBeNull();
    }
  });

  it('checks people and services before the result, and the result before the questionnaires', () => {
    expect(INTENT_RULES.map((rule) => rule.id)).toEqual([
      'SS-ADVISOR', 'SS-COUNSELLING', 'SS-PRIVACY', 'SS-SOMEONE-ELSE', 'SR-CATEGORY',
      'WL-INSTRUMENT', 'ED-INSTRUMENT', 'TM-NAMED', 'ED-STATE', 'WL-QUANTITY',
    ]);
    // A question that touches two rules takes the earlier one.
    expect(ruleOf('Will my Academic Advisor see that my result is High Risk?')).toBe('SS-ADVISOR');
    expect(ruleOf('Why is my screening result high when my Mental Demand is low?')).toBe('SR-CATEGORY');
  });

  it('never contradicts a label in the training examples or the test set', () => {
    const labelled = [...intentExamples.examples, ...intentTestSet.examples];
    const fired = labelled.filter((example) => matchIntentRule(example.text) !== null);
    expect(fired.length).toBeGreaterThan(20);
    expect(fired.filter((example) => matchIntentRule(example.text)?.intent !== example.intent)).toEqual([]);
  });
});

describe('Small talk', () => {
  it('recognises short greetings and thanks in both languages', () => {
    for (const text of ['hi', 'Hello!', 'halo', 'Selamat pagi', 'Assalamualaikum', 'hai kak', 'p']) {
      expect(detectSmallTalk(text)).toBe('greeting');
    }
    for (const text of ['thanks', 'Thank you so much', 'makasih ya', 'Terima kasih banyak', 'ok thanks', 'oke', 'sip']) {
      expect(detectSmallTalk(text)).toBe('thanks');
    }
  });

  it('leaves real questions alone, even when they start politely', () => {
    for (const text of [
      'Hi, why am I so tired?',
      'Halo, saya mau tanya soal burnout',
      'Thanks, but what does high risk mean?',
      'I am not ok',
      'ok so what should I do next?',
      'Terima kasih, lalu bagaimana cara daftar konseling?',
      '',
    ]) {
      expect(detectSmallTalk(text)).toBeNull();
    }
  });

  it('never hides a message that needs the crisis reply', async () => {
    // The crisis check runs first, whatever the message looks like.
    const { deps } = fakeDeps();
    expect((await ask(deps, 'hi, I want to die')).kind).toBe('crisis');
  });
});

describe('Intent vote', () => {
  it('lets any labelled neighbours vote, closest first, with the same rule', () => {
    const neighbours = [
      { id: 'WL-01', intent: 'WORKLOAD' as const, similarity: 0.8 },
      { id: 'TM-01', intent: 'TIME_MANAGEMENT' as const, similarity: 0.7 },
      { id: 'TM-02', intent: 'TIME_MANAGEMENT' as const, similarity: 0.6 },
      { id: 'BI-01', intent: 'BURNOUT_INFO' as const, similarity: 0.1 },
    ];
    // Three voters: two weaker ones outweigh the single closest.
    const three = voteIntent([...neighbours].reverse(), 3);
    expect(three.intent).toBe('TIME_MANAGEMENT');
    expect(three.neighbours.map((n) => n.id)).toEqual(['WL-01', 'TM-01', 'TM-02']);
    expect(three.confidence).toBeCloseTo(1.3 / 2.1, 5);
    // One voter: the closest decides.
    expect(voteIntent(neighbours, 1).intent).toBe('WORKLOAD');
    expect(voteIntent([], 5)).toMatchObject({ intent: null, confidence: 0 });
  });

  it('gives the same answer as classifyIntent for the same neighbours', () => {
    const query = axis('WORKLOAD', { TIME_MANAGEMENT: 0.4 });
    const direct = classifyIntent(query, EXAMPLES, { k: 3 });
    const viaVote = voteIntent(
      EXAMPLES.map((example) => ({ id: example.id, intent: example.intent, similarity: cosineSimilarity(query, example.embedding) })),
      3,
    );
    expect(viaVote).toEqual(direct);
  });
});

describe('Passage selection', () => {
  it('keeps the closest passages, at most four', () => {
    const chosen = selectPassages(PASSAGES, null);
    expect(chosen.map((p) => p.id)).toEqual(['TM-01', 'WL-05', 'SS-06', 'SS-05']);
  });

  it('gives the recognised topic a small bonus, not a veto', () => {
    expect(selectPassages(PASSAGES, 'WORKLOAD')[0].id).toBe('WL-05');
    // 0.50 + 0.05 is still below the others, so the far passage stays out.
    expect(selectPassages(PASSAGES, 'SCREENING_RESULT').map((p) => p.id)).not.toContain('SR-07');
    expect(selectPassages(PASSAGES, 'SCREENING_RESULT', { limit: 5 }).map((p) => p.id)).toContain('SR-07');
  });

  it('drops duplicates and passages below the minimum', () => {
    const chosen = selectPassages([...PASSAGES, PASSAGES[0]], null, { minSimilarity: 0.65, limit: 10 });
    expect(chosen.map((p) => p.id)).toEqual(['TM-01', 'WL-05']);
  });
});

describe('Crisis safeguard', () => {
  it('recognises messages that suggest danger, in English and Indonesian', () => {
    for (const message of [
      'I want to kill myself',
      'sometimes I think about suicide',
      "I don't want to live anymore",
      'I have been hurting myself',
      'I just want to die',
      'aku pengen bunuh diri',
      'rasanya ingin mati saja',
      'saya ingin mengakhiri hidup saya',
      'aku gak mau hidup lagi',
      'aku sering menyakiti diri sendiri',
    ]) {
      expect(detectCrisis(message)).toBe(true);
    }
  });

  it('does not fire on ordinary study talk', () => {
    for (const message of [
      'This deadline is killing me',
      'I am dead tired after class',
      'My motivation died this semester',
      'How do I stop procrastinating?',
      'Tugas ini bikin capek banget',
      'Saya ingin hidup lebih teratur',
      'deadline mematikan',
    ]) {
      expect(detectCrisis(message)).toBe(false);
    }
  });

  it('tells Indonesian from English for the fixed replies', () => {
    expect(looksIndonesian('aku capek banget sama tugas kuliah')).toBe(true);
    expect(looksIndonesian('I feel overwhelmed by my assignments')).toBe(false);
  });
});

describe('Chat prompt', () => {
  it('gives the model the passages and the question, and nothing personal', () => {
    const messages = buildChatMessages({
      message: 'How do I stop putting things off?',
      history: [],
      intent: 'TIME_MANAGEMENT',
      passages: PASSAGES.slice(0, 2),
    });
    expect(messages[0]).toEqual({ role: 'system', content: CHAT_SYSTEM_PROMPT });
    const user = messages[messages.length - 1];
    expect(user.role).toBe('user');
    expect(user.content).toContain('TOPIC: Time management');
    expect(user.content).toContain('[TM-01] Putting tasks off');
    expect(user.content).toContain('QUESTION: How do I stop putting things off?');
    expect(user.content).not.toContain('RESULT');
  });

  it('states the stored result as a fixed fact only when it was looked up', () => {
    const withResult = buildChatMessages({ message: 'What does my result mean?', history: [], intent: 'SCREENING_RESULT', passages: PASSAGES, result: HIGH_RISK });
    const text = withResult[withResult.length - 1].content;
    expect(text).toContain('Category: High risk');
    expect(text).toContain('Validated next step: a counselling referral');
    expect(text).toMatch(/never change it/);
    // No staff label reaches the model.
    expect(text).not.toMatch(/curative/i);

    const none = buildChatMessages({ message: 'What does my result mean?', history: [], intent: 'SCREENING_RESULT', passages: PASSAGES, result: null });
    expect(none[none.length - 1].content).toContain('has not completed a screening yet');
  });

  it('forbids deciding a category and inventing details', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/never decide, guess, change or dispute a screening category/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Use only what is written in the KNOWLEDGE passages/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Do not diagnose/);
  });

  it('forbids offering what the passages do not contain and renaming the service', () => {
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Do not offer tips, techniques, exercises or topics that the passages do not contain/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/"Layanan Psikologis PNJ"\. Write that name as it is and never translate it/);
    expect(CHAT_SYSTEM_PROMPT).toMatch(/Breathing Room is only the app/);
    // The rules stay numbered without gaps.
    const numbers = [...CHAT_SYSTEM_PROMPT.matchAll(/^(\d+)\. /gm)].map((match) => Number(match[1]));
    expect(numbers).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
  });

  it('keeps only the last few turns and clips long ones', () => {
    const history = Array.from({ length: 10 }, (_, i) => ({
      role: (i % 2 === 0 ? 'user' : 'assistant') as 'user' | 'assistant',
      text: i === 9 ? 'x'.repeat(2000) : `turn ${i}`,
    }));
    const messages = buildChatMessages({ message: 'next', history, intent: null, passages: [] });
    expect(messages).toHaveLength(1 + 6 + 1);
    expect(messages[1].content).toBe('turn 4');
    expect(messages[6].content.length).toBeLessThanOrEqual(601);
    expect(messages[7].content).toContain('(no passage matched this question)');
  });
});

describe('Chat reply check', () => {
  const context = { passages: PASSAGES, category: null };

  it('accepts a grounded reply and tidies stray markdown and passage codes', () => {
    const check = checkChatReply('**Putting tasks off** costs more later [TM-01]. Starting small helps.', context);
    expect(check).toEqual({ ok: true, text: 'Putting tasks off costs more later. Starting small helps.' });
  });

  it('accepts contact details that are in the passages, exactly', () => {
    expect(checkChatReply('You can message Layanan Psikologis PNJ on WhatsApp at +62 823-7957-4919.', context).ok).toBe(true);
    expect(checkChatReply('Daftar lewat https://s.pnj.ac.id/KonselingPNJ.', context).ok).toBe(true);
    expect(checkChatReply('The hotline is open 08.00 to 16.00 WIB.', context).ok).toBe(true);
  });

  it('rejects invented phone numbers and links', () => {
    expect(checkChatReply('Call 0812-1110-0992 for help.', context).ok).toBe(false);
    expect(checkChatReply('Message +62 823-7957-4918.', context).ok).toBe(false);
    expect(checkChatReply('See https://layanan.pnj.ac.id for details.', context).ok).toBe(false);
    expect(checkChatReply('Visit konseling.pnj.ac.id today.', context).ok).toBe(false);
    // The real number is rejected too when its passage was not retrieved.
    expect(checkChatReply('WhatsApp +62 823-7957-4919.', { passages: PASSAGES.slice(0, 2), category: null }).ok).toBe(false);
  });

  it('rejects a category the rule base did not decide', () => {
    // No stored result was given to the model.
    expect(checkChatReply('Your result is High risk, which means extra support is recommended.', context).ok).toBe(false);
    expect(checkChatReply('Hasil skriningmu risiko tinggi.', context).ok).toBe(false);
    // A stored result was given: only that category may be stated.
    const stored = { passages: PASSAGES, category: 'HIGH_RISK' as const };
    expect(checkChatReply('Your result is High risk, which means extra support is recommended.', stored).ok).toBe(true);
    expect(checkChatReply('Your result is Low risk, so there is nothing to worry about.', stored).ok).toBe(false);
    expect(checkChatReply('Hasil skrining kamu adalah risiko sedang.', stored).ok).toBe(false);
  });

  it('allows explaining the categories in general', () => {
    expect(checkChatReply('High risk means extra support is recommended. Low risk means you are coping.', context).ok).toBe(true);
  });

  it('rejects diagnosis, medication, staff labels, rule ids, empty and overlong replies', () => {
    expect(checkChatReply('It sounds like you have depression.', context).ok).toBe(false);
    expect(checkChatReply('Sepertinya kamu mengalami gangguan kecemasan.', context).ok).toBe(false);
    expect(checkChatReply('You could ask about medication.', context).ok).toBe(false);
    expect(checkChatReply('This is a curative step.', context).ok).toBe(false);
    expect(checkChatReply('Rule R9 applies to you.', context).ok).toBe(false);
    expect(checkChatReply('   ', context).ok).toBe(false);
    expect(checkChatReply(Array(260).fill('word').join(' '), context).ok).toBe(false);
  });
});

describe('Chat flow', () => {
  it('answers from the retrieved passages', async () => {
    const { deps, calls } = fakeDeps();
    const reply = await ask(deps, 'How do I stop procrastinating?');
    expect(reply.kind).toBe('answer');
    expect(reply.intent).toBe('TIME_MANAGEMENT');
    expect(reply.passageIds).toEqual(['TM-01', 'WL-05', 'SS-06', 'SS-05']);
    expect(reply.reply).toContain('Putting tasks off');
    expect(calls.embed).toEqual(['How do I stop procrastinating?']);
    expect(calls.complete).toHaveLength(1);
    // The stored result is not looked up for an unrelated question.
    expect(calls.result).toEqual([]);
    expect(calls.complete[0][calls.complete[0].length - 1].content).not.toContain('RESULT');
  });

  it('answers a crisis message with the fixed reply and calls no model', async () => {
    const { deps, calls } = fakeDeps();
    const english = await ask(deps, 'I want to kill myself');
    expect(english).toEqual({ kind: 'crisis', reply: CRISIS_REPLY.en, intent: null, passageIds: [] });
    const indonesian = await ask(deps, 'aku pengen bunuh diri, aku capek');
    expect(indonesian.reply).toBe(CRISIS_REPLY.id);
    expect(calls.embed).toEqual([]);
    expect(calls.complete).toEqual([]);
    expect(CRISIS_REPLY.en).toContain('+62 823-7957-4919');
    expect(CRISIS_REPLY.id).toContain('+62 823-7957-4919');
  });

  it('passes the stored result, for that student only, when the question is about it', async () => {
    const { deps, calls } = fakeDeps({ intent: 'SCREENING_RESULT', replies: ['Your result is High risk, which means extra support is recommended.'] });
    const reply = await ask(deps, 'What does my result mean?');
    expect(reply.kind).toBe('answer');
    expect(calls.result).toEqual(['student-1']);
    expect(calls.complete[0][calls.complete[0].length - 1].content).toContain('Category: High risk');
  });

  it('also looks the result up when another topic mentions it', async () => {
    const { deps, calls } = fakeDeps({ intent: 'STUDENT_SUPPORT' });
    await ask(deps, 'Siapa yang bisa melihat hasil skrining saya?');
    expect(calls.result).toEqual(['student-1']);
  });

  it('never shows a reply that states a category the rule base did not decide', async () => {
    const { deps, calls } = fakeDeps({
      intent: 'SCREENING_RESULT',
      replies: ['Your result is Low risk, nothing to worry about.', 'Your category is No burnout.'],
    });
    const reply = await ask(deps, 'Is my result really high risk?');
    expect(calls.complete).toHaveLength(2);
    expect(reply.kind).toBe('fallback');
    expect(reply.reply).not.toMatch(/low risk|no burnout/i);
    expect(calls.log.filter(([event]) => event === 'reply_rejected')).toHaveLength(2);
  });

  it('retries once after a rejected reply', async () => {
    const { deps, calls } = fakeDeps({ replies: ['Call 0812-0000-0000 now.', 'Starting small helps.'] });
    const reply = await ask(deps, 'How do I stop procrastinating?');
    expect(reply).toMatchObject({ kind: 'answer', reply: 'Starting small helps.' });
    expect(calls.complete).toHaveLength(2);
  });

  it('falls back to the closest passage when the language model fails', async () => {
    const { deps } = fakeDeps({ complete: async () => { throw new Error('Groq request failed with status 503'); } });
    const reply = await ask(deps, 'How do I stop procrastinating?');
    expect(reply.kind).toBe('fallback');
    expect(reply.reply).toContain(PASSAGES[0].content);
    expect(reply.passageIds).toEqual(['TM-01']);
    const indonesian = await ask(deps, 'Bagaimana cara berhenti menunda tugas kuliah saya?');
    expect(indonesian.reply).toContain('dalam bahasa Inggris');
  });

  it('turns away a question when even the closest passage is far from it', async () => {
    // The closest passage in PASSAGES has similarity 0.71.
    const { deps, calls } = fakeDeps({ replies: ['Starting small helps.', 'Starting small helps.'] });
    const input = { studentId: 's', message: 'What is the capital of France?', history: [] };
    const reply = await answerChat(deps, input, { minPassageSimilarity: 0.75 });
    expect(reply).toMatchObject({ kind: 'out_of_scope', reply: OUT_OF_SCOPE_REPLY.en, intent: null, passageIds: [] });
    expect(calls.complete).toEqual([]);
    expect(calls.log).toContainEqual(['out_of_scope', { topPassageSimilarity: 0.71 }]);
    // Exactly at the threshold, and with the check switched off, it is answered.
    expect((await answerChat(deps, input, { minPassageSimilarity: 0.71 })).kind).toBe('answer');
    expect((await answerChat(deps, input)).kind).toBe('answer');
  });

  it('reads a follow-up together with the previous question before turning it away', async () => {
    const far = PASSAGES.map((passage) => ({ ...passage, similarity: passage.similarity - 0.3 }));
    const { deps, calls } = fakeDeps({
      matchPassages: async () => (calls.embed[calls.embed.length - 1].includes('procrastinating') ? PASSAGES : far),
    });
    const history = [
      { role: 'user' as const, text: 'How do I stop procrastinating?' },
      { role: 'assistant' as const, text: 'Starting small helps.' },
    ];
    const reply = await answerChat(deps, { studentId: 's', message: 'Can you explain that more?', history }, { minPassageSimilarity: 0.6 });
    expect(reply.kind).toBe('answer');
    expect(calls.embed).toEqual(['Can you explain that more?', 'How do I stop procrastinating?\nCan you explain that more?']);
    expect(calls.log).toContainEqual(['follow_up', { alone: 0.41, withPrevious: 0.71 }]);
    // The model still gets the student's own words as the question.
    const prompt = calls.complete[0][calls.complete[0].length - 1].content;
    expect(prompt).toContain('QUESTION: Can you explain that more?');

    // Without an earlier question there is nothing to join, so it is turned away.
    const alone = await answerChat(deps, { studentId: 's', message: 'Can you explain that more?', history: [] }, { minPassageSimilarity: 0.6 });
    expect(alone.kind).toBe('out_of_scope');
    // An off-topic follow-up to an off-topic question stays turned away.
    const stillFar = fakeDeps({ matchPassages: async () => far });
    const off = await answerChat(stillFar.deps, { studentId: 's', message: 'And of Spain?', history: [{ role: 'user', text: 'What is the capital of France?' }] }, { minPassageSimilarity: 0.6 });
    expect(off.kind).toBe('out_of_scope');
    expect(stillFar.calls.complete).toEqual([]);
  });

  it('lets a keyword rule decide the intent over the vote', async () => {
    // The embedding and the passages point at time management.
    const { deps, calls } = fakeDeps();
    const reply = await ask(deps, 'Can the DPA see how I plan my study time?');
    expect(reply.intent).toBe('STUDENT_SUPPORT');
    // Student support passages get the bonus, but here they stay behind the closer ones.
    expect(reply.passageIds).toEqual(['TM-01', 'WL-05', 'SS-06', 'SS-05']);
    const retrieved = calls.log.find(([event]) => event === 'retrieved')?.[1];
    expect(retrieved).toMatchObject({ intent: 'STUDENT_SUPPORT', decidedBy: 'SS-ADVISOR', votedIntent: 'TIME_MANAGEMENT' });

    // Without a matching rule the vote decides, and the log says so.
    const plain = fakeDeps();
    const voted = await ask(plain.deps, 'How do I stop procrastinating?');
    expect(voted.intent).toBe('TIME_MANAGEMENT');
    expect(plain.calls.log.find(([event]) => event === 'retrieved')?.[1]).toMatchObject({ decidedBy: 'vote', votedIntent: 'TIME_MANAGEMENT' });

    // A rule about the result also makes the stored result available.
    const result = fakeDeps();
    await ask(result.deps, 'Hasilnya risiko tinggi, maksudnya apa?');
    expect(result.calls.result).toEqual(['student-1']);
  });

  it('reads a short message both on its own and with the previous question', async () => {
    const counselling = PASSAGES.filter((passage) => passage.topic === 'STUDENT_SUPPORT').map((passage) => ({ ...passage, similarity: passage.similarity + 0.25 }));
    const { deps, calls } = fakeDeps({
      intent: 'STUDENT_SUPPORT',
      // Alone: the counselling passages. With the previous question: the usual list.
      matchPassages: async () => (calls.embed.length === 1 ? counselling : PASSAGES),
    });
    const history = [{ role: 'user' as const, text: 'How do I stop procrastinating?' }];
    const reply = await answerChat(deps, { studentId: 's', message: 'Is counselling free?', history });
    expect(calls.embed).toHaveLength(2);
    // The message's own matches (0.85, 0.83) stay ahead of the previous topic (0.71, 0.70).
    expect(reply.passageIds).toEqual(['SS-06', 'SS-05', 'TM-01', 'WL-05']);
    expect(reply.intent).toBe('STUDENT_SUPPORT');

    // A longer message is complete in itself: one search, even with history.
    const longer = fakeDeps();
    await answerChat(longer.deps, { studentId: 's', message: 'How can I stop putting off my assignments every week?', history });
    expect(longer.calls.embed).toHaveLength(1);
    // And the first message of a conversation has nothing to be joined with.
    const first = fakeDeps();
    await answerChat(first.deps, { studentId: 's', message: 'Is counselling free?', history: [] });
    expect(first.calls.embed).toHaveLength(1);
  });

  it('merges two result lists, keeping each passage once with its higher similarity', () => {
    const merged = mergeMatches(
      [{ ...PASSAGES[0], similarity: 0.5 }, PASSAGES[2]],
      [PASSAGES[0], PASSAGES[1]],
    );
    expect(merged.map((match) => [match.id, match.similarity])).toEqual([['TM-01', 0.71], ['WL-05', 0.7], ['SS-06', 0.6]]);
  });

  it('answers a bare greeting or thanks without looking anything up', async () => {
    const { deps, calls } = fakeDeps();
    expect(await ask(deps, 'Halo kak')).toMatchObject({ kind: 'small_talk', reply: SMALL_TALK_REPLY.greeting.id, intent: null });
    expect(await ask(deps, 'Thanks a lot!')).toMatchObject({ kind: 'small_talk', reply: SMALL_TALK_REPLY.thanks.en });
    expect(await ask(deps, 'oke, terima kasih ya')).toMatchObject({ kind: 'small_talk', reply: SMALL_TALK_REPLY.thanks.id });
    expect(calls.embed).toEqual([]);
    expect(calls.complete).toEqual([]);
  });

  it('reports clearly when the data has not been indexed or embedding fails', async () => {
    const noExamples = fakeDeps({ loadIntentExamples: async () => [] });
    await expect(ask(noExamples.deps, 'Tell me about burnout')).rejects.toMatchObject({ kind: 'NOT_READY' });
    const noPassages = fakeDeps({ matchPassages: async () => [] });
    await expect(ask(noPassages.deps, 'Tell me about burnout')).rejects.toMatchObject({ kind: 'NOT_READY' });
    const noEmbedding = fakeDeps({ embedQuery: async () => { throw new Error('quota'); } });
    await expect(ask(noEmbedding.deps, 'Tell me about burnout')).rejects.toBeInstanceOf(ChatError);
  });

  it('never logs the words of the student', async () => {
    const { deps, calls } = fakeDeps();
    await ask(deps, 'a very private sentence about my week');
    expect(JSON.stringify(calls.log)).not.toContain('private sentence');
  });
});

describe('Gemini embedding request', () => {
  const vector = Array.from({ length: EMBEDDING_DIMENSIONS }, (_, i) => i / 1000);
  const respond = (status: number, body: unknown) =>
    (async () => ({ ok: status >= 200 && status < 300, status, json: async () => body, text: async () => JSON.stringify(body) })) as unknown as typeof fetch;

  it('formats questions and passages differently', () => {
    expect(formatForEmbedding('query', '  How do I  rest? ')).toBe('task: search result | query: How do I rest?');
    expect(formatForEmbedding('document', 'Rest matters.', 'Time management')).toBe('title: Time management | text: Rest matters.');
    expect(formatForEmbedding('document', 'Rest matters.')).toBe('title: none | text: Rest matters.');
  });

  it('sends the key in a header, asks for 768 dimensions, and reads the vector', async () => {
    let seen: { url: string; init: { headers: Record<string, string>; body: string } } | undefined;
    const fetchImpl = (async (url: string, init: { headers: Record<string, string>; body: string }) => {
      seen = { url, init };
      return { ok: true, status: 200, json: async () => ({ embedding: { values: vector } }), text: async () => '' };
    }) as unknown as typeof fetch;
    const values = await requestGeminiEmbedding({ apiKey: 'test-key', model: 'gemini-embedding-2', text: 'hello', kind: 'query', fetchImpl });
    expect(values).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(seen?.url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-2:embedContent');
    expect(seen?.url).not.toContain('test-key');
    expect(seen?.init.headers['x-goog-api-key']).toBe('test-key');
    const body = JSON.parse(seen?.init.body ?? '{}');
    expect(body.output_dimensionality).toBe(EMBEDDING_DIMENSIONS);
    expect(body.content.parts[0].text).toBe('task: search result | query: hello');
  });

  it('also reads the batch-style response shape', async () => {
    const values = await requestGeminiEmbedding({ apiKey: 'k', model: 'm', text: 't', kind: 'query', fetchImpl: respond(200, { embeddings: [{ values: vector }] }) });
    expect(values).toHaveLength(EMBEDDING_DIMENSIONS);
  });

  it('fails clearly on an error status, a missing vector, or the wrong size', async () => {
    await expect(requestGeminiEmbedding({ apiKey: 'k', model: 'm', text: 't', kind: 'query', fetchImpl: respond(429, { error: 'quota' }) })).rejects.toMatchObject({ status: 429 });
    await expect(requestGeminiEmbedding({ apiKey: 'k', model: 'm', text: 't', kind: 'query', fetchImpl: respond(200, {}) })).rejects.toBeInstanceOf(GeminiError);
    await expect(requestGeminiEmbedding({ apiKey: 'k', model: 'm', text: 't', kind: 'query', fetchImpl: respond(200, { embedding: { values: [1, 2, 3] } }) })).rejects.toThrow(/expected 768/);
  });
});
