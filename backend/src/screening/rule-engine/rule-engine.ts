import { BINARY_LEVELS, WORKLOAD_LEVELS } from '../screening.types.js';
import type { BinaryLevel, WorkloadLevel } from '../screening.types.js';
import { RULE_BASE } from './rule-base.js';
import type { Rule } from './rule-base.js';

function ruleKey(
  workload: WorkloadLevel,
  exhaustion: BinaryLevel,
  disengagement: BinaryLevel,
): string {
  return `${workload}|${exhaustion}|${disengagement}`;
}

/**
 * Builds the lookup index and verifies the rule base is a complete grid:
 * every one of the 5 x 2 x 2 = 20 combinations has exactly one rule.
 * Fails at startup rather than at the first unlucky screening.
 */
export function buildRuleIndex(rules: ReadonlyArray<Rule>): Map<string, Rule> {
  const index = new Map<string, Rule>();
  for (const rule of rules) {
    const key = ruleKey(rule.workload, rule.exhaustion, rule.disengagement);
    const existing = index.get(key);
    if (existing) {
      throw new Error(
        `Rule base conflict: ${existing.id} and ${rule.id} cover the same combination (${key}).`,
      );
    }
    index.set(key, rule);
  }
  for (const workload of WORKLOAD_LEVELS) {
    for (const exhaustion of BINARY_LEVELS) {
      for (const disengagement of BINARY_LEVELS) {
        const key = ruleKey(workload, exhaustion, disengagement);
        if (!index.has(key)) {
          throw new Error(`Rule base gap: no rule covers ${key}.`);
        }
      }
    }
  }
  return index;
}

const RULE_INDEX = buildRuleIndex(RULE_BASE);

/**
 * Deterministic inference: returns the single rule matching the three
 * categorical inputs. No AI is involved in this decision.
 */
export function inferRule(
  workload: WorkloadLevel,
  exhaustion: BinaryLevel,
  disengagement: BinaryLevel,
): Rule {
  const rule = RULE_INDEX.get(ruleKey(workload, exhaustion, disengagement));
  if (!rule) {
    throw new Error(
      `No rule for workload=${workload}, exhaustion=${exhaustion}, disengagement=${disengagement}.`,
    );
  }
  return rule;
}

const RULES_BY_ID = new Map(RULE_BASE.map((rule) => [rule.id, rule]));

/** Looks a rule up by its id (R1 ... R20), e.g. for a stored screening. */
export function getRuleById(id: string): Rule {
  const rule = RULES_BY_ID.get(id);
  if (!rule) {
    throw new Error(`Unknown rule id: ${id}.`);
  }
  return rule;
}
