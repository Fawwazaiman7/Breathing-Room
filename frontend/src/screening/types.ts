export type NasaTlxDimension =
  | 'mentalDemand'
  | 'physicalDemand'
  | 'temporalDemand'
  | 'performance'
  | 'effort'
  | 'frustration';

export type WorkloadLevel =
  | 'VERY_LOW'
  | 'LOW'
  | 'MODERATE'
  | 'HIGH'
  | 'VERY_HIGH';

export type BinaryLevel = 'LOW' | 'HIGH';

export type ScreeningCategory =
  | 'NO_BURNOUT'
  | 'LOW_RISK'
  | 'MODERATE_RISK'
  | 'HIGH_RISK';

/** Body of POST /screening. */
export interface ScreeningPayload {
  nasaTlx: {
    pairwiseChoices: NasaTlxDimension[];
    ratings: Record<NasaTlxDimension, number>;
  };
  olbi: { answers: number[] };
}

export interface Recommendation {
  id: string;
  en: string;
}

/** Response of POST /screening. */
export interface SubmittedScreening {
  id: string;
  createdAt: string;
  ruleId: string;
  category: ScreeningCategory;
  nasaTlx: { score: number; level: WorkloadLevel };
  olbi: {
    exhaustion: { score: number; level: BinaryLevel };
    disengagement: { score: number; level: BinaryLevel };
  };
  recommendation: Recommendation;
}

/** One item of GET /screening/mine. */
export interface ScreeningHistoryItem {
  id: string;
  createdAt: string;
  category: ScreeningCategory;
  ruleId: string;
  workload: { score: number; level: WorkloadLevel };
  exhaustion: { score: number; level: BinaryLevel };
  disengagement: { score: number; level: BinaryLevel };
  recommendation: Recommendation;
  feedbackText: string | null;
  /** The note in Indonesian, saved separately. Absent from older servers. */
  feedbackTextId?: string | null;
}

export function toHistoryItem(result: SubmittedScreening): ScreeningHistoryItem {
  return {
    id: result.id,
    createdAt: result.createdAt,
    category: result.category,
    ruleId: result.ruleId,
    workload: { score: result.nasaTlx.score, level: result.nasaTlx.level },
    exhaustion: result.olbi.exhaustion,
    disengagement: result.olbi.disengagement,
    recommendation: result.recommendation,
    feedbackText: null,
  };
}
