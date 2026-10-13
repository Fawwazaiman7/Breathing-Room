import type { ChatIntent, PassageMatch } from './chat.types.js';

/**
 * Chooses which passages go into the prompt.
 *
 * The database returns the passages closest in meaning to the question.
 * Passages from the recognised topic get a small bonus, so the intent
 * nudges the choice without being able to hide a clearly better passage
 * from another topic.
 */

export const INTENT_BOOST = 0.05;
export const MAX_CONTEXT_PASSAGES = 4;

export interface RetrievalOptions {
  boost?: number;
  limit?: number;
  /** Passages below this similarity are dropped. 0 keeps everything. */
  minSimilarity?: number;
}

export function selectPassages(
  matches: readonly PassageMatch[],
  intent: ChatIntent | null,
  options: RetrievalOptions = {},
): PassageMatch[] {
  const boost = options.boost ?? INTENT_BOOST;
  const limit = options.limit ?? MAX_CONTEXT_PASSAGES;
  const minSimilarity = options.minSimilarity ?? 0;

  const seen = new Set<string>();
  return matches
    .filter((match) => {
      if (seen.has(match.id) || match.similarity < minSimilarity) {
        return false;
      }
      seen.add(match.id);
      return true;
    })
    .map((match) => ({
      match,
      score: match.similarity + (match.topic === intent ? boost : 0),
    }))
    .sort((a, b) => b.score - a.score || a.match.id.localeCompare(b.match.id))
    .slice(0, limit)
    .map((entry) => entry.match);
}
