import type { ChatMessage } from '../feedback/feedback.prompt.js';
import { checkChatReply } from './chat.checker.js';
import { classifyWithPassages } from './chat.intent.js';
import { matchIntentRule } from './chat.intent-rules.js';
import { buildChatMessages } from './chat.prompt.js';
import type { ChatResultContext } from './chat.prompt.js';
import { selectPassages } from './chat.retrieval.js';
import {
  CRISIS_REPLY,
  detectCrisis,
  detectSmallTalk,
  FALLBACK_REPLY,
  looksIndonesian,
  OUT_OF_SCOPE_REPLY,
  SMALL_TALK_REPLY,
  smallTalkLanguage,
} from './chat.safety.js';
import type {
  ChatIntent,
  ChatTurn,
  IntentExample,
  PassageMatch,
} from './chat.types.js';

/**
 * One turn of the Support Chat, independent of NestJS, Supabase, Gemini and
 * Groq so the whole flow can be unit-tested with stand-ins.
 *
 * Steps:
 *   1. Safety: a message that suggests danger gets a fixed reply. Nothing
 *      is sent to any model. A bare greeting or thanks also gets a fixed
 *      reply.
 *   2. Retrieval: the question is embedded and the closest knowledge base
 *      passages are fetched. A short follow-up ("what do you mean?") is
 *      also read together with the student's previous question. If even
 *      the closest passage is far from the question, the knowledge base
 *      has nothing to say about it and the question is turned away without
 *      calling the language model.
 *   3. Intent: a few keyword rules decide the cases that are certain (a
 *      question that mentions the Academic Advisor is about student
 *      support). Otherwise the closest example questions and the closest
 *      passages vote (nearest neighbours). Passages from the recognised
 *      topic get a small bonus when the best few are chosen.
 *   4. Generation: the language model answers from those passages only.
 *   5. Check: the reply is verified before it is shown. A reply that fails
 *      twice is replaced by a passage from the knowledge base.
 *
 * The screening category is never decided here. When a question is about
 * the student's result, the stored rule-based outcome is passed in as a
 * fixed fact for the model to explain.
 */

export type ChatReplyKind =
  | 'answer'
  | 'fallback'
  | 'crisis'
  | 'small_talk'
  | 'out_of_scope';

export interface ChatReply {
  kind: ChatReplyKind;
  reply: string;
  intent: ChatIntent | null;
  /** Ids of the passages the reply was built from. */
  passageIds: string[];
}

export type ChatErrorKind = 'NOT_READY' | 'EMBEDDING_FAILED';

/** The chat cannot answer at all (as opposed to answering with a fallback). */
export class ChatError extends Error {
  kind: ChatErrorKind;

  constructor(kind: ChatErrorKind, message: string) {
    super(message);
    this.name = 'ChatError';
    this.kind = kind;
  }
}

/** What the flow needs from the outside world. */
export interface ChatDeps {
  embedQuery(text: string): Promise<number[]>;
  loadIntentExamples(): Promise<IntentExample[]>;
  /** Closest passages first. */
  matchPassages(embedding: number[], count: number): Promise<PassageMatch[]>;
  /** The student's newest screening, or null when there is none. */
  latestResult(studentId: string): Promise<ChatResultContext | null>;
  complete(messages: ChatMessage[]): Promise<string>;
  /** Diagnostics for the server log. Never receives the student's words. */
  log?(event: string, detail: Record<string, unknown>): void;
}

export interface ChatOptions {
  /**
   * When the closest knowledge base passage is less similar to the question
   * than this, the question is treated as outside the six topics.
   * 0 switches the check off.
   */
  minPassageSimilarity?: number;
  /** How many passages to request from the database before choosing. */
  candidateCount?: number;
}

export interface ChatInput {
  studentId: string;
  message: string;
  history: readonly ChatTurn[];
}

export const MAX_CHAT_ATTEMPTS = 2;
export const DEFAULT_CANDIDATE_COUNT = 8;
/** Longest text embedded when a follow-up is read with the previous message. */
export const MAX_FOLLOW_UP_CHARACTERS = 800;
/** A message of at most this many words is also read with the previous one. */
export const SHORT_MESSAGE_WORDS = 5;

/** Both lists in one, each passage once with its higher similarity. */
export function mergeMatches(
  first: readonly PassageMatch[],
  second: readonly PassageMatch[],
): PassageMatch[] {
  const byId = new Map<string, PassageMatch>();
  for (const match of [...first, ...second]) {
    const known = byId.get(match.id);
    if (!known || match.similarity > known.similarity) {
      byId.set(match.id, match);
    }
  }
  return [...byId.values()].sort(
    (a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id),
  );
}

/** Questions that are about the student's own result need the stored one. */
const MENTIONS_RESULT =
  /\b(result|results|category|risk|screening|hasil|kategori|risiko|skrining)\b/i;

export async function answerChat(
  deps: ChatDeps,
  input: ChatInput,
  options: ChatOptions = {},
): Promise<ChatReply> {
  const message = input.message.trim();
  const language = looksIndonesian(message) ? 'id' : 'en';

  // 1. Safety first, and without calling any model.
  if (detectCrisis(message)) {
    deps.log?.('crisis', {});
    return {
      kind: 'crisis',
      reply: CRISIS_REPLY[language],
      intent: null,
      passageIds: [],
    };
  }

  const smallTalk = detectSmallTalk(message);
  if (smallTalk) {
    deps.log?.('small_talk', { type: smallTalk });
    return {
      kind: 'small_talk',
      reply: SMALL_TALK_REPLY[smallTalk][smallTalkLanguage(message)],
      intent: null,
      passageIds: [],
    };
  }

  // 2. Retrieval.
  const examples = await deps.loadIntentExamples();
  if (examples.length === 0) {
    throw new ChatError(
      'NOT_READY',
      'No intent examples are stored. Run "node kb/index-kb.mjs" in the backend folder.',
    );
  }
  const search = async (text: string) => {
    let vector: number[];
    try {
      vector = await deps.embedQuery(text);
    } catch (error) {
      throw new ChatError(
        'EMBEDDING_FAILED',
        error instanceof Error ? error.message : 'Embedding request failed.',
      );
    }
    const matches = await deps.matchPassages(
      vector,
      options.candidateCount ?? DEFAULT_CANDIDATE_COUNT,
    );
    if (matches.length === 0) {
      throw new ChatError(
        'NOT_READY',
        'The knowledge base is empty. Run "node kb/index-kb.mjs" in the backend folder.',
      );
    }
    return { vector, matches };
  };
  const best = (matches: readonly PassageMatch[]) =>
    Math.max(...matches.map((match) => match.similarity));

  const minPassageSimilarity = options.minPassageSimilarity ?? 0;
  const alone = await search(message);
  const vectors = [alone.vector];
  let candidates = alone.matches;

  // "What do you mean?" says nothing on its own. A short message, or one
  // the knowledge base has nothing close to, is also read together with
  // the student's previous question, and the two sets of passages are
  // combined. A short question that is complete in itself keeps its own
  // matches, because each passage counts with its higher similarity.
  const previous = [...input.history]
    .reverse()
    .find((turn) => turn.role === 'user' && turn.text.trim() !== '');
  const short = message.split(/\s+/).length <= SHORT_MESSAGE_WORDS;
  if (previous && (short || best(candidates) < minPassageSimilarity)) {
    const joined = await search(
      `${previous.text.trim()}\n${message}`.slice(0, MAX_FOLLOW_UP_CHARACTERS),
    );
    deps.log?.('follow_up', {
      alone: Number(best(alone.matches).toFixed(3)),
      withPrevious: Number(best(joined.matches).toFixed(3)),
    });
    vectors.push(joined.vector);
    candidates = mergeMatches(alone.matches, joined.matches);
  }

  const topPassageSimilarity = best(candidates);
  if (topPassageSimilarity < minPassageSimilarity) {
    deps.log?.('out_of_scope', {
      topPassageSimilarity: Number(topPassageSimilarity.toFixed(3)),
    });
    return {
      kind: 'out_of_scope',
      reply: OUT_OF_SCOPE_REPLY[language],
      intent: null,
      passageIds: [],
    };
  }

  // 3. Intent: a keyword rule when one applies, otherwise the closest
  // examples and the closest passages vote.
  const voted = classifyWithPassages(vectors, examples, candidates);
  const ruled = matchIntentRule(message);
  const classified = ruled ? { ...voted, intent: ruled.intent } : voted;
  const passages = selectPassages(candidates, classified.intent);

  // The stored result is looked up only when the question is about it.
  const wantsResult =
    classified.intent === 'SCREENING_RESULT' || MENTIONS_RESULT.test(message);
  const result = wantsResult
    ? await deps.latestResult(input.studentId)
    : undefined;

  const base = {
    intent: classified.intent,
    passageIds: passages.map((passage) => passage.id),
  };
  deps.log?.('retrieved', {
    intent: classified.intent,
    // Which rule decided, or "vote". When a rule decided, votedIntent is
    // what the vote alone would have said.
    decidedBy: ruled ? ruled.rule : 'vote',
    votedIntent: voted.intent,
    confidence: Number(voted.confidence.toFixed(3)),
    topSimilarity: Number(classified.topSimilarity.toFixed(3)),
    topPassageSimilarity: Number(topPassageSimilarity.toFixed(3)),
    passages: base.passageIds,
    withResult: wantsResult,
  });

  // 4 and 5. Generation, then the check.
  const messages = buildChatMessages({
    message,
    history: input.history,
    intent: classified.intent,
    passages,
    result,
  });
  for (let attempt = 1; attempt <= MAX_CHAT_ATTEMPTS; attempt += 1) {
    let raw: string;
    try {
      raw = await deps.complete(messages);
    } catch (error) {
      deps.log?.('generation_failed', {
        attempt,
        error: error instanceof Error ? error.message : String(error),
      });
      break;
    }
    const check = checkChatReply(raw, {
      passages,
      category: result?.category ?? null,
    });
    if (check.ok) {
      return { kind: 'answer', reply: check.text, ...base };
    }
    deps.log?.('reply_rejected', { attempt, reason: check.reason });
  }

  // No acceptable reply: show the closest passage as it is written.
  const top = passages[0];
  return {
    kind: 'fallback',
    reply: top
      ? `${FALLBACK_REPLY[language].withPassage}\n\n${top.content}`
      : FALLBACK_REPLY[language].empty,
    intent: classified.intent,
    passageIds: top ? [top.id] : [],
  };
}
