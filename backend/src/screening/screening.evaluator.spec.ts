import { NASA_TLX_PAIRS } from './nasa-tlx/nasa-tlx.constants.js';
import { OLBI_ITEMS } from './olbi/olbi.constants.js';
import { evaluateScreening, toStudentView } from './screening.evaluator.js';
import type { ScreeningInput } from './screening.evaluator.js';
import { ScreeningInputError } from './screening.types.js';
import type { NasaTlxDimension } from './screening.types.js';

function ratingsOf(value: number): Record<NasaTlxDimension, number> {
  return {
    mentalDemand: value,
    physicalDemand: value,
    temporalDemand: value,
    performance: value,
    effort: value,
    frustration: value,
  };
}

/** With identical ratings the score equals that rating, whatever the weights. */
function inputFor(
  rating: number,
  negativeAnswer: number,
  positiveAnswer: number,
): ScreeningInput {
  return {
    nasaTlx: {
      pairwiseChoices: NASA_TLX_PAIRS.map(([a]) => a),
      ratings: ratingsOf(rating),
    },
    olbi: {
      answers: OLBI_ITEMS.map((item) =>
        item.wording === 'negative' ? negativeAnswer : positiveAnswer,
      ),
    },
  };
}

describe('Screening evaluator (end to end)', () => {
  it('evaluates the worked example from the simulation document', () => {
    const result = evaluateScreening({
      nasaTlx: {
        pairwiseChoices: [
          'mentalDemand',
          'mentalDemand',
          'performance',
          'mentalDemand',
          'mentalDemand',
          'physicalDemand',
          'physicalDemand',
          'effort',
          'frustration',
          'performance',
          'temporalDemand',
          'frustration',
          'effort',
          'performance',
          'effort',
        ],
        ratings: {
          mentalDemand: 70,
          physicalDemand: 40,
          temporalDemand: 50,
          performance: 60,
          effort: 65,
          frustration: 55,
        },
      },
      olbi: { answers: [2, 2, 3, 2, 3, 3, 3, 3, 4, 4, 3, 3, 2, 3, 3, 2] },
    });

    expect(result.nasaTlx.score).toBe(59.67);
    expect(result.nasaTlx.level).toBe('HIGH');
    expect(result.olbi.exhaustion.level).toBe('HIGH');
    expect(result.olbi.disengagement.level).toBe('HIGH');
    // The document reports R9 for this student because it scores OLBI in the
    // opposite direction. With burnout-direction scoring the match is R19.
    // Both rules give High Risk with a counselling referral.
    expect(result.rule.id).toBe('R19');
    expect(result.category).toBe('HIGH_RISK');
    expect(result.interventionLevel).toBe('CURATIVE');
    expect(result.recommendation.id).toBe(
      'Kuratif dengan rujukan konseling ke BK PNJ',
    );
  });

  it('returns No Burnout for a light load and an engaged student', () => {
    const result = evaluateScreening(inputFor(20, 1, 4));
    expect(result.rule.id).toBe('R2');
    expect(result.category).toBe('NO_BURNOUT');
  });

  it('returns Low Risk for a very high load that is still being coped with', () => {
    const result = evaluateScreening(inputFor(90, 1, 4));
    expect(result.rule.id).toBe('R5');
    expect(result.category).toBe('LOW_RISK');
  });

  it('returns Moderate Risk for exhaustion without disengagement at a standard load', () => {
    // Exhaustion items answered as burned out, disengagement items as engaged.
    const input = inputFor(40, 1, 4);
    input.olbi.answers = OLBI_ITEMS.map((item) => {
      const burnedOut = item.dimension === 'exhaustion';
      if (item.wording === 'negative') return burnedOut ? 4 : 1;
      return burnedOut ? 1 : 4;
    });
    const result = evaluateScreening(input);
    expect(result.rule.id).toBe('R8');
    expect(result.category).toBe('MODERATE_RISK');
    expect(result.interventionLevel).toBe('PREVENTIVE');
  });

  it('keeps the clinical rationale out of the student view', () => {
    const view = toStudentView(evaluateScreening(inputFor(90, 4, 1)));
    expect(view.ruleId).toBe('R20');
    expect(view.category).toBe('HIGH_RISK');
    expect(JSON.stringify(view)).not.toContain('rationale');
    expect(JSON.stringify(view)).not.toContain('breakdown');
  });

  it('rejects incomplete input', () => {
    const input = inputFor(50, 2, 2);
    input.olbi.answers = input.olbi.answers.slice(0, 10);
    expect(() => evaluateScreening(input)).toThrow(ScreeningInputError);
  });
});
