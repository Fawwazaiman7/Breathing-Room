import { calculateNasaTlx } from './nasa-tlx/nasa-tlx.calculator.js';
import type {
  NasaTlxInput,
  NasaTlxResult,
} from './nasa-tlx/nasa-tlx.calculator.js';
import { calculateOlbi } from './olbi/olbi.calculator.js';
import type { OlbiResult } from './olbi/olbi.calculator.js';
import { RECOMMENDATIONS } from './rule-engine/rule-base.js';
import type { InterventionLevel, Rule } from './rule-engine/rule-base.js';
import { inferRule } from './rule-engine/rule-engine.js';
import type { ScreeningCategory } from './screening.types.js';

export interface ScreeningInput {
  nasaTlx: NasaTlxInput;
  olbi: {
    /** 16 answers in item order, 1 = Strongly Disagree ... 4 = Strongly Agree. */
    answers: number[];
  };
}

/** Full result for storage, the advisor view, and the LLM feedback prompt. */
export interface ScreeningResult {
  nasaTlx: NasaTlxResult;
  olbi: OlbiResult;
  rule: Rule;
  category: ScreeningCategory;
  interventionLevel: InterventionLevel;
  recommendation: { id: string; en: string };
}

/** What the student-facing API returns: no clinical rationale. */
export interface StudentScreeningView {
  nasaTlx: NasaTlxResult;
  olbi: Pick<OlbiResult, 'exhaustion' | 'disengagement'>;
  ruleId: string;
  category: ScreeningCategory;
  recommendation: { id: string; en: string };
}

/**
 * Runs the whole screening pipeline:
 * NASA-TLX score -> OLBI scores -> rule match -> category + recommendation.
 */
export function evaluateScreening(input: ScreeningInput): ScreeningResult {
  const nasaTlx = calculateNasaTlx(input.nasaTlx);
  const olbi = calculateOlbi(input.olbi?.answers);
  const rule = inferRule(
    nasaTlx.level,
    olbi.exhaustion.level,
    olbi.disengagement.level,
  );

  return {
    nasaTlx,
    olbi,
    rule,
    category: rule.category,
    interventionLevel: rule.interventionLevel,
    recommendation: RECOMMENDATIONS[rule.interventionLevel],
  };
}

export function toStudentView(result: ScreeningResult): StudentScreeningView {
  return {
    nasaTlx: result.nasaTlx,
    olbi: {
      exhaustion: result.olbi.exhaustion,
      disengagement: result.olbi.disengagement,
    },
    ruleId: result.rule.id,
    category: result.category,
    recommendation: result.recommendation,
  };
}
