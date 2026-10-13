import type { InterventionLevel } from '../screening/rule-engine/rule-base.js';
import { getRuleById } from '../screening/rule-engine/rule-engine.js';
import type {
  BinaryLevel,
  ScreeningCategory,
  WorkloadLevel,
} from '../screening/screening.types.js';

/**
 * Everything the LLM is told about one screening.
 *
 * Deliberately minimal: no name, student number, class, raw answers, or
 * scores. Only the categorical outcome already decided by the rule base.
 */
export interface FeedbackContext {
  category: ScreeningCategory;
  workloadLevel: WorkloadLevel;
  exhaustionLevel: BinaryLevel;
  disengagementLevel: BinaryLevel;
  interventionLevel: InterventionLevel;
  /** Psychologist's rationale for the matched rule (background only). */
  rationale: string;
  /** The validated recommended action, in plain words. */
  recommendation: string;
}

/**
 * The validated action for each intervention level, in plain words for the
 * prompt. The validated labels themselves ("Promotif", "Preventif",
 * "Kuratif") are clinical categories for staff: given to the model, they
 * were copied straight into notes ("The next step is a Curative: ...").
 * Each sentence states the same action as the validated table and nothing
 * more. In particular it names no resource the app does not provide.
 */
export const PLAIN_RECOMMENDATIONS: Record<InterventionLevel, string> = {
  PROMOTIVE:
    'Self-help on their own: keep learning and practising healthy study and rest habits independently. No appointment or referral is needed.',
  PREVENTIVE:
    'Arrange a consultation with their Academic Advisor (DPA) to talk about their workload and how they have been feeling.',
  CURATIVE:
    'Go for counselling at the PNJ Counselling Unit (BK PNJ). This is a referral to counselling.',
};

/** The stored columns needed to build the context. */
export interface FeedbackSource {
  rule_id: string;
  category: ScreeningCategory;
  workload_level: WorkloadLevel;
  exhaustion_level: BinaryLevel;
  disengagement_level: BinaryLevel;
  intervention_level: InterventionLevel;
}

export function toFeedbackContext(stored: FeedbackSource): FeedbackContext {
  const rule = getRuleById(stored.rule_id);
  return {
    category: stored.category,
    workloadLevel: stored.workload_level,
    exhaustionLevel: stored.exhaustion_level,
    disengagementLevel: stored.disengagement_level,
    interventionLevel: stored.intervention_level,
    rationale: rule.rationale.en,
    recommendation: PLAIN_RECOMMENDATIONS[stored.intervention_level],
  };
}
