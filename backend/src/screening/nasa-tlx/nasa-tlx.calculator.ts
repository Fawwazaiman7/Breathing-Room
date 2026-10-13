import {
  NASA_TLX_DIMENSIONS,
  ScreeningInputError,
  round2,
} from '../screening.types.js';
import type { NasaTlxDimension, WorkloadLevel } from '../screening.types.js';
import {
  NASA_TLX_PAIRS,
  NASA_TLX_RATING_MAX,
  NASA_TLX_RATING_MIN,
  NASA_TLX_TOTAL_WEIGHT,
  WORKLOAD_BANDS,
} from './nasa-tlx.constants.js';

export interface NasaTlxInput {
  /**
   * The dimension the student picked in each of the 15 comparisons, in the
   * same order as NASA_TLX_PAIRS.
   */
  pairwiseChoices: NasaTlxDimension[];
  /** Rating 0-100 for each of the six dimensions. */
  ratings: Record<NasaTlxDimension, number>;
}

export interface NasaTlxResult {
  /** How many times each dimension was chosen (sums to 15). */
  weights: Record<NasaTlxDimension, number>;
  /** rating x weight for each dimension. */
  products: Record<NasaTlxDimension, number>;
  /** WWL: the sum of all products. */
  weightedWorkload: number;
  /** WWL / 15, rounded to two decimals for display. */
  score: number;
  level: WorkloadLevel;
}

function emptyRecord(): Record<NasaTlxDimension, number> {
  return {
    mentalDemand: 0,
    physicalDemand: 0,
    temporalDemand: 0,
    performance: 0,
    effort: 0,
    frustration: 0,
  };
}

export function calculateWeights(
  pairwiseChoices: NasaTlxDimension[],
): Record<NasaTlxDimension, number> {
  if (
    !Array.isArray(pairwiseChoices) ||
    pairwiseChoices.length !== NASA_TLX_PAIRS.length
  ) {
    throw new ScreeningInputError(
      `NASA-TLX requires exactly ${NASA_TLX_PAIRS.length} pairwise choices.`,
    );
  }

  const weights = emptyRecord();
  pairwiseChoices.forEach((choice, index) => {
    const [optionA, optionB] = NASA_TLX_PAIRS[index];
    if (choice !== optionA && choice !== optionB) {
      throw new ScreeningInputError(
        `Comparison ${index + 1} must be "${optionA}" or "${optionB}".`,
      );
    }
    weights[choice] += 1;
  });
  return weights;
}

export function classifyWorkload(score: number): WorkloadLevel {
  if (
    !Number.isFinite(score) ||
    score < NASA_TLX_RATING_MIN ||
    score > NASA_TLX_RATING_MAX
  ) {
    throw new ScreeningInputError(
      'NASA-TLX score must be between 0 and 100.',
    );
  }
  let level: WorkloadLevel = WORKLOAD_BANDS[0].level;
  for (const band of WORKLOAD_BANDS) {
    if (score >= band.min) {
      level = band.level;
    }
  }
  return level;
}

export function calculateNasaTlx(input: NasaTlxInput): NasaTlxResult {
  const weights = calculateWeights(input.pairwiseChoices);
  const products = emptyRecord();
  let weightedWorkload = 0;

  for (const dimension of NASA_TLX_DIMENSIONS) {
    const rating = input.ratings?.[dimension];
    if (
      typeof rating !== 'number' ||
      !Number.isFinite(rating) ||
      rating < NASA_TLX_RATING_MIN ||
      rating > NASA_TLX_RATING_MAX
    ) {
      throw new ScreeningInputError(
        `Rating for "${dimension}" must be a number between 0 and 100.`,
      );
    }
    products[dimension] = rating * weights[dimension];
    weightedWorkload += products[dimension];
  }

  // Classify on the unrounded score so rounding never moves a band edge.
  const rawScore = weightedWorkload / NASA_TLX_TOTAL_WEIGHT;

  return {
    weights,
    products,
    weightedWorkload,
    score: round2(rawScore),
    level: classifyWorkload(rawScore),
  };
}
