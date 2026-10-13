import { RECOMMENDATIONS } from './rule-engine/rule-base.js';
import type { InterventionLevel } from './rule-engine/rule-base.js';
import type { ScreeningInput, ScreeningResult } from './screening.evaluator.js';
import { NASA_TLX_DIMENSIONS, round2 } from './screening.types.js';
import type {
  BinaryLevel,
  NasaTlxDimension,
  ScreeningCategory,
  WorkloadLevel,
} from './screening.types.js';

/** Columns written to public.screenings (see 001_initial_schema.sql). */
export interface ScreeningRow {
  student_id: string;
  nasa_pairwise_choices: NasaTlxDimension[];
  nasa_ratings: Record<NasaTlxDimension, number>;
  olbi_answers: number[];
  nasa_weights: Record<NasaTlxDimension, number>;
  nasa_weighted_workload: number;
  nasa_score: number;
  workload_level: WorkloadLevel;
  exhaustion_score: number;
  exhaustion_level: BinaryLevel;
  disengagement_score: number;
  disengagement_level: BinaryLevel;
  rule_id: string;
  category: ScreeningCategory;
  intervention_level: InterventionLevel;
}

/** A row as read back from public.screenings. */
export interface StoredScreening extends ScreeningRow {
  id: string;
  created_at: string;
  feedback_text: string | null;
  feedback_generated_at: string | null;
}

/** One past screening as shown to the student. */
export interface ScreeningHistoryItem {
  id: string;
  createdAt: string;
  category: ScreeningCategory;
  ruleId: string;
  workload: { score: number; level: WorkloadLevel };
  exhaustion: { score: number; level: BinaryLevel };
  disengagement: { score: number; level: BinaryLevel };
  recommendation: { id: string; en: string };
  feedbackText: string | null;
}

export function toScreeningRow(
  studentId: string,
  input: ScreeningInput,
  result: ScreeningResult,
): ScreeningRow {
  // Copy the six ratings by name so nothing else can ride along into storage.
  const ratings = {} as Record<NasaTlxDimension, number>;
  for (const dimension of NASA_TLX_DIMENSIONS) {
    ratings[dimension] = input.nasaTlx.ratings[dimension];
  }

  return {
    student_id: studentId,
    nasa_pairwise_choices: [...input.nasaTlx.pairwiseChoices],
    nasa_ratings: ratings,
    olbi_answers: [...input.olbi.answers],
    nasa_weights: { ...result.nasaTlx.weights },
    nasa_weighted_workload: round2(result.nasaTlx.weightedWorkload),
    nasa_score: result.nasaTlx.score,
    workload_level: result.nasaTlx.level,
    exhaustion_score: result.olbi.exhaustion.score,
    exhaustion_level: result.olbi.exhaustion.level,
    disengagement_score: result.olbi.disengagement.score,
    disengagement_level: result.olbi.disengagement.level,
    rule_id: result.rule.id,
    category: result.category,
    intervention_level: result.interventionLevel,
  };
}

export function toHistoryItem(stored: StoredScreening): ScreeningHistoryItem {
  return {
    id: stored.id,
    createdAt: stored.created_at,
    category: stored.category,
    ruleId: stored.rule_id,
    workload: {
      score: Number(stored.nasa_score),
      level: stored.workload_level,
    },
    exhaustion: {
      score: Number(stored.exhaustion_score),
      level: stored.exhaustion_level,
    },
    disengagement: {
      score: Number(stored.disengagement_score),
      level: stored.disengagement_level,
    },
    recommendation: RECOMMENDATIONS[stored.intervention_level],
    feedbackText: stored.feedback_text,
  };
}
