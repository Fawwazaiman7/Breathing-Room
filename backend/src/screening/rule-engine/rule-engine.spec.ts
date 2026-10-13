import { BINARY_LEVELS, WORKLOAD_LEVELS } from '../screening.types.js';
import type {
  BinaryLevel,
  ScreeningCategory,
  WorkloadLevel,
} from '../screening.types.js';
import { RECOMMENDATIONS, RULE_BASE } from './rule-base.js';
import type { InterventionLevel } from './rule-base.js';
import { buildRuleIndex, inferRule } from './rule-engine.js';

type Expected = [
  id: string,
  workload: WorkloadLevel,
  exhaustion: BinaryLevel,
  disengagement: BinaryLevel,
  category: ScreeningCategory,
  intervention: InterventionLevel,
];

/**
 * Typed in separately from rule-base.ts, straight from the validated table,
 * so a transcription slip in either place makes this test fail.
 * Columns: rule, X1 workload, X2a exhaustion, X2b disengagement, Y, action.
 */
const VALIDATED_TABLE: Expected[] = [
  ['R1', 'VERY_LOW', 'LOW', 'LOW', 'NO_BURNOUT', 'PROMOTIVE'],
  ['R2', 'LOW', 'LOW', 'LOW', 'NO_BURNOUT', 'PROMOTIVE'],
  ['R3', 'MODERATE', 'LOW', 'LOW', 'NO_BURNOUT', 'PROMOTIVE'],
  ['R4', 'HIGH', 'LOW', 'LOW', 'LOW_RISK', 'PROMOTIVE'],
  ['R5', 'VERY_HIGH', 'LOW', 'LOW', 'LOW_RISK', 'PROMOTIVE'],
  ['R6', 'VERY_LOW', 'HIGH', 'LOW', 'MODERATE_RISK', 'PREVENTIVE'],
  ['R7', 'LOW', 'HIGH', 'LOW', 'MODERATE_RISK', 'PREVENTIVE'],
  ['R8', 'MODERATE', 'HIGH', 'LOW', 'MODERATE_RISK', 'PREVENTIVE'],
  ['R9', 'HIGH', 'HIGH', 'LOW', 'HIGH_RISK', 'CURATIVE'],
  ['R10', 'VERY_HIGH', 'HIGH', 'LOW', 'HIGH_RISK', 'CURATIVE'],
  ['R11', 'VERY_LOW', 'LOW', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
  ['R12', 'LOW', 'LOW', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
  ['R13', 'MODERATE', 'LOW', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
  ['R14', 'HIGH', 'LOW', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
  ['R15', 'VERY_HIGH', 'LOW', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
  ['R16', 'VERY_LOW', 'HIGH', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
  ['R17', 'LOW', 'HIGH', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
  ['R18', 'MODERATE', 'HIGH', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
  ['R19', 'HIGH', 'HIGH', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
  ['R20', 'VERY_HIGH', 'HIGH', 'HIGH', 'HIGH_RISK', 'CURATIVE'],
];

describe('Rule engine', () => {
  it('contains exactly 20 rules, R1 to R20', () => {
    expect(RULE_BASE).toHaveLength(20);
    expect(RULE_BASE.map((rule) => rule.id)).toEqual(
      Array.from({ length: 20 }, (_, i) => `R${i + 1}`),
    );
  });

  for (const row of VALIDATED_TABLE) {
    const [id, workload, exhaustion, disengagement, category, action] = row;
    it(`${id}: ${workload} workload, ${exhaustion} exhaustion, ${disengagement} disengagement -> ${category}`, () => {
      const rule = inferRule(workload, exhaustion, disengagement);
      expect(rule.id).toBe(id);
      expect(rule.category).toBe(category);
      expect(rule.interventionLevel).toBe(action);
    });
  }

  it('matches exactly one rule for every possible combination', () => {
    const matched = new Set<string>();
    for (const workload of WORKLOAD_LEVELS) {
      for (const exhaustion of BINARY_LEVELS) {
        for (const disengagement of BINARY_LEVELS) {
          matched.add(inferRule(workload, exhaustion, disengagement).id);
        }
      }
    }
    expect(matched.size).toBe(20);
  });

  it('gives every rule a rationale and every level a recommendation', () => {
    for (const rule of RULE_BASE) {
      expect(rule.rationale.id.length).toBeGreaterThan(0);
      expect(rule.rationale.en.length).toBeGreaterThan(0);
      expect(RECOMMENDATIONS[rule.interventionLevel].id.length).toBeGreaterThan(
        0,
      );
    }
  });

  it('refuses a rule base with a duplicate or a missing combination', () => {
    expect(() => buildRuleIndex([...RULE_BASE, RULE_BASE[0]])).toThrow(
      /conflict/,
    );
    expect(() => buildRuleIndex(RULE_BASE.slice(1))).toThrow(/gap/);
  });
});
