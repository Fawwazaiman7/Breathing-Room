import { CHAT_INTENTS } from './chat.types.js';
import type { ChatIntent, IntentExample, PassageMatch } from './chat.types.js';

/**
 * Intent recognition by nearest neighbours.
 *
 * The student's question is turned into a vector and compared with two
 * kinds of labelled text: the example questions (each tagged with an
 * intent) and the knowledge base passages (each filed under a topic). The
 * few closest ones vote, each with a weight equal to its similarity, and
 * the intent with the most weight wins. No language model is involved, so
 * the same question always gets the same intent.
 *
 * Measured with kb/evaluate-chat.mjs on the 30 example questions
 * (leave-one-out): examples alone 16/30, examples and passages together
 * 21/30. The second is the one the server uses (classifyWithPassages).
 */

export function cosineSimilarity(a: number[], b: number[]): number {
  const length = Math.min(a.length, b.length);
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < length; i += 1) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  if (normA === 0 || normB === 0) {
    return 0;
  }
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

export interface IntentNeighbour {
  id: string;
  intent: ChatIntent;
  similarity: number;
}

export interface IntentResult {
  /** Null when there is no neighbour, or none is close enough (see minSimilarity). */
  intent: ChatIntent | null;
  /** Share of the vote won by the chosen intent, between 0 and 1. */
  confidence: number;
  /** Similarity of the single closest example. */
  topSimilarity: number;
  /** The examples that voted, closest first. */
  neighbours: IntentNeighbour[];
}

export interface IntentOptions {
  /** How many of the closest examples vote. */
  k?: number;
  /**
   * Below this similarity to the closest example the question is treated
   * as outside the six topics. 0 switches the check off.
   */
  minSimilarity?: number;
  /** Example ids to leave out, used for leave-one-out evaluation. */
  excludeIds?: readonly string[];
}

export const DEFAULT_INTENT_K = 5;

export function classifyIntent(
  query: number[],
  examples: readonly IntentExample[],
  options: IntentOptions = {},
): IntentResult {
  const k = Math.max(1, options.k ?? DEFAULT_INTENT_K);
  const minSimilarity = options.minSimilarity ?? 0;
  const excluded = new Set(options.excludeIds ?? []);

  const neighbours = examples
    .filter((example) => !excluded.has(example.id))
    .map((example) => ({
      id: example.id,
      intent: example.intent,
      similarity: cosineSimilarity(query, example.embedding),
    }))
    // Ties are broken by id so the result never depends on row order.
    .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id))
    .slice(0, k);

  const topSimilarity = neighbours[0]?.similarity ?? 0;
  if (neighbours.length === 0 || topSimilarity < minSimilarity) {
    return { intent: null, confidence: 0, topSimilarity, neighbours };
  }
  return voteIntent(neighbours, k);
}

/**
 * The vote itself, for any list of labelled neighbours. Kept separate so
 * the evaluation script can try other sources of neighbours (for instance
 * knowledge base passages, which carry a topic) with exactly the same rule.
 */
export function voteIntent(
  candidates: readonly IntentNeighbour[],
  k: number = DEFAULT_INTENT_K,
): IntentResult {
  const neighbours = [...candidates]
    // Ties are broken by id so the result never depends on row order.
    .sort((a, b) => b.similarity - a.similarity || a.id.localeCompare(b.id))
    .slice(0, Math.max(1, k));
  const topSimilarity = neighbours[0]?.similarity ?? 0;
  if (neighbours.length === 0) {
    return { intent: null, confidence: 0, topSimilarity, neighbours };
  }

  const votes = new Map<ChatIntent, number>();
  for (const neighbour of neighbours) {
    // A negative similarity means "points the other way"; it gets no vote.
    const weight = Math.max(neighbour.similarity, 0);
    votes.set(neighbour.intent, (votes.get(neighbour.intent) ?? 0) + weight);
  }
  const total = [...votes.values()].reduce((sum, value) => sum + value, 0);

  let winner: ChatIntent = neighbours[0].intent;
  let best = -1;
  // Fixed order, so an exact tie always resolves the same way. The closest
  // neighbour's intent wins a tie.
  for (const intent of CHAT_INTENTS) {
    const weight = votes.get(intent) ?? 0;
    if (
      weight > best ||
      (weight === best && intent === neighbours[0].intent)
    ) {
      winner = intent;
      best = weight;
    }
  }

  return {
    intent: winner,
    confidence: total > 0 ? best / total : 0,
    topSimilarity,
    neighbours,
  };
}

export interface PassageVoteOptions {
  /** How many of the closest examples and passages vote. */
  k?: number;
  /** Example ids to leave out, used for leave-one-out evaluation. */
  excludeIds?: readonly string[];
}

/**
 * The method the server uses: the closest example questions and the closest
 * knowledge base passages vote together.
 *
 * `queries` holds one vector, or two when a short follow-up is also read
 * together with the previous question; an example then counts with its
 * higher similarity. `passages` are the search results for the same
 * question, with the similarity the database reported.
 */
export function classifyWithPassages(
  queries: readonly number[][],
  examples: readonly IntentExample[],
  passages: readonly Pick<PassageMatch, 'id' | 'topic' | 'similarity'>[],
  options: PassageVoteOptions = {},
): IntentResult {
  const excluded = new Set(options.excludeIds ?? []);
  const neighbours: IntentNeighbour[] = [];
  for (const example of examples) {
    if (excluded.has(example.id)) {
      continue;
    }
    neighbours.push({
      id: example.id,
      intent: example.intent,
      similarity: Math.max(
        ...queries.map((query) => cosineSimilarity(query, example.embedding)),
      ),
    });
  }
  for (const passage of passages) {
    neighbours.push({
      id: passage.id,
      intent: passage.topic,
      similarity: passage.similarity,
    });
  }
  return voteIntent(neighbours, options.k ?? DEFAULT_INTENT_K);
}
