import { ScreeningInputError, round2 } from '../screening.types.js';
import type { BinaryLevel, OlbiDimension } from '../screening.types.js';
import {
  OLBI_ANSWER_MAX,
  OLBI_ANSWER_MIN,
  OLBI_CUTOFFS,
  OLBI_CUTOFF_INCLUSIVE,
  OLBI_ITEMS,
} from './olbi.constants.js';
import type { OlbiItem } from './olbi.constants.js';

export interface OlbiDimensionResult {
  /** Mean of the eight item scores (1-4), rounded to two decimals. */
  score: number;
  level: BinaryLevel;
}

export interface OlbiResult {
  exhaustion: OlbiDimensionResult;
  disengagement: OlbiDimensionResult;
  /** Scored value (1-4) per item after direction correction, items 1-16. */
  itemScores: number[];
}

/**
 * Converts a raw answer (1 = Strongly Disagree ... 4 = Strongly Agree) into
 * an item score where a HIGHER score always means MORE burnout.
 *
 *   negative wording ("I feel drained"):   score = answer
 *   positive wording ("I feel energised"): score = 5 - answer
 *
 * IMPORTANT - differs from section 4.2 of the simulation document, which
 * reverses the negatively worded items instead. That scheme makes a high
 * score mean LESS burnout, which contradicts the "High if above the cut-off"
 * classification and the rule table. The direction used here is the one the
 * cut-offs were defined for (Peterson et al., 2008). Confirm with the
 * psychologist; to switch, swap the two branches below.
 */
export function scoreOlbiItem(item: OlbiItem, answer: number): number {
  return item.wording === 'negative'
    ? answer
    : OLBI_ANSWER_MAX + OLBI_ANSWER_MIN - answer;
}

export function classifyOlbiDimension(
  dimension: OlbiDimension,
  meanScore: number,
): BinaryLevel {
  const cutoff = OLBI_CUTOFFS[dimension];
  const isHigh = OLBI_CUTOFF_INCLUSIVE
    ? meanScore >= cutoff
    : meanScore > cutoff;
  return isHigh ? 'HIGH' : 'LOW';
}

/**
 * @param answers 16 raw answers in item order (index 0 = item 1), each an
 * integer from 1 (Strongly Disagree) to 4 (Strongly Agree).
 */
export function calculateOlbi(answers: number[]): OlbiResult {
  if (!Array.isArray(answers) || answers.length !== OLBI_ITEMS.length) {
    throw new ScreeningInputError(
      `OLBI requires exactly ${OLBI_ITEMS.length} answers.`,
    );
  }

  const sums: Record<OlbiDimension, number> = {
    exhaustion: 0,
    disengagement: 0,
  };
  const counts: Record<OlbiDimension, number> = {
    exhaustion: 0,
    disengagement: 0,
  };

  const itemScores = OLBI_ITEMS.map((item, index) => {
    const answer = answers[index];
    if (
      !Number.isInteger(answer) ||
      answer < OLBI_ANSWER_MIN ||
      answer > OLBI_ANSWER_MAX
    ) {
      throw new ScreeningInputError(
        `OLBI item ${item.number} must be an integer from 1 to 4.`,
      );
    }
    const score = scoreOlbiItem(item, answer);
    sums[item.dimension] += score;
    counts[item.dimension] += 1;
    return score;
  });

  const exhaustionMean = sums.exhaustion / counts.exhaustion;
  const disengagementMean = sums.disengagement / counts.disengagement;

  return {
    exhaustion: {
      score: round2(exhaustionMean),
      level: classifyOlbiDimension('exhaustion', exhaustionMean),
    },
    disengagement: {
      score: round2(disengagementMean),
      level: classifyOlbiDimension('disengagement', disengagementMean),
    },
    itemScores,
  };
}
