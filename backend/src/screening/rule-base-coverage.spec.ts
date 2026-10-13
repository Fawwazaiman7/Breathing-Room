import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { evaluateScreening } from './screening.evaluator.js';
import type { ScreeningInput } from './screening.evaluator.js';

/**
 * End-to-end coverage of the psychologist-validated rule table.
 *
 * Each case feeds real questionnaire answers through the whole pipeline
 * (NASA-TLX score -> OLBI scores -> rule match) and compares the outcome
 * with expected values that were worked out by hand.
 *
 * The cases live in backend/test-cases/rule-base-cases.json so the same
 * file can be run against the live API (test-cases/run-rule-tests.mjs).
 */

interface TestCase {
  id: string;
  title: string;
  input: ScreeningInput;
  expected: {
    nasaWeightedWorkload: number;
    nasaScore: number;
    workloadLevel: string;
    exhaustionScore: number;
    exhaustionLevel: string;
    disengagementScore: number;
    disengagementLevel: string;
    ruleId: string;
    category: string;
    recommendation: string;
  };
}

interface TestCaseFile {
  ruleCases: TestCase[];
  boundaryCases: TestCase[];
}

const CASES = JSON.parse(
  readFileSync(
    join(__dirname, '..', '..', 'test-cases', 'rule-base-cases.json'),
    'utf8',
  ),
) as TestCaseFile;

function run(testCase: TestCase) {
  const result = evaluateScreening(testCase.input);
  return {
    nasaWeightedWorkload: result.nasaTlx.weightedWorkload,
    nasaScore: result.nasaTlx.score,
    workloadLevel: result.nasaTlx.level,
    exhaustionScore: result.olbi.exhaustion.score,
    exhaustionLevel: result.olbi.exhaustion.level,
    disengagementScore: result.olbi.disengagement.score,
    disengagementLevel: result.olbi.disengagement.level,
    ruleId: result.rule.id,
    category: result.category,
    recommendation: result.recommendation.id,
  };
}

describe('Rule base coverage: one full screening per validated rule', () => {
  it('has exactly one case for each of R1 to R20', () => {
    expect(CASES.ruleCases.map((c) => c.expected.ruleId)).toEqual(
      Array.from({ length: 20 }, (_, i) => `R${i + 1}`),
    );
  });

  for (const testCase of CASES.ruleCases) {
    it(`${testCase.id} -> ${testCase.expected.category} (${testCase.title})`, () => {
      expect(run(testCase)).toEqual(testCase.expected);
    });
  }
});

describe('Rule base coverage: threshold boundaries', () => {
  for (const testCase of CASES.boundaryCases) {
    it(`${testCase.id} -> ${testCase.expected.ruleId} ${testCase.expected.category} (${testCase.title})`, () => {
      expect(run(testCase)).toEqual(testCase.expected);
    });
  }
});
