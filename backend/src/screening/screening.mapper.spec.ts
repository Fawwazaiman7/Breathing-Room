import { evaluateScreening } from './screening.evaluator.js';
import type { ScreeningInput } from './screening.evaluator.js';
import { toHistoryItem, toScreeningRow } from './screening.mapper.js';

const STUDENT_ID = '00000000-0000-0000-0000-0000000000a1';

/** "Mahasiswa Contoh A" from the simulation document. */
const EXAMPLE: ScreeningInput = {
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
};

describe('Screening mapper', () => {
  it('maps a result to the screenings table columns', () => {
    const row = toScreeningRow(STUDENT_ID, EXAMPLE, evaluateScreening(EXAMPLE));
    expect(row).toEqual({
      student_id: STUDENT_ID,
      nasa_pairwise_choices: EXAMPLE.nasaTlx.pairwiseChoices,
      nasa_ratings: EXAMPLE.nasaTlx.ratings,
      olbi_answers: EXAMPLE.olbi.answers,
      nasa_weights: {
        mentalDemand: 4,
        physicalDemand: 2,
        temporalDemand: 1,
        performance: 3,
        effort: 3,
        frustration: 2,
      },
      nasa_weighted_workload: 895,
      nasa_score: 59.67,
      workload_level: 'HIGH',
      exhaustion_score: 2.25,
      exhaustion_level: 'HIGH',
      disengagement_score: 2.88,
      disengagement_level: 'HIGH',
      rule_id: 'R19',
      category: 'HIGH_RISK',
      intervention_level: 'CURATIVE',
    });
  });

  it('stores only the six known ratings', () => {
    const input: ScreeningInput = {
      ...EXAMPLE,
      nasaTlx: {
        ...EXAMPLE.nasaTlx,
        ratings: { ...EXAMPLE.nasaTlx.ratings, injected: 1 } as never,
      },
    };
    const row = toScreeningRow(STUDENT_ID, input, evaluateScreening(input));
    expect(Object.keys(row.nasa_ratings).sort()).toEqual([
      'effort',
      'frustration',
      'mentalDemand',
      'performance',
      'physicalDemand',
      'temporalDemand',
    ]);
  });

  it('never stores the clinical rationale', () => {
    const row = toScreeningRow(STUDENT_ID, EXAMPLE, evaluateScreening(EXAMPLE));
    expect(JSON.stringify(row)).not.toContain('rationale');
  });

  it('turns a stored row into a history item', () => {
    const row = toScreeningRow(STUDENT_ID, EXAMPLE, evaluateScreening(EXAMPLE));
    const item = toHistoryItem({
      ...row,
      id: 'screening-1',
      created_at: '2026-10-11T01:00:00+00:00',
      feedback_text: null,
      feedback_generated_at: null,
    });
    expect(item).toEqual({
      id: 'screening-1',
      createdAt: '2026-10-11T01:00:00+00:00',
      category: 'HIGH_RISK',
      ruleId: 'R19',
      workload: { score: 59.67, level: 'HIGH' },
      exhaustion: { score: 2.25, level: 'HIGH' },
      disengagement: { score: 2.88, level: 'HIGH' },
      recommendation: {
        id: 'Kuratif dengan rujukan konseling ke layanan konseling kampus',
        en: 'Curative: counselling referral to the campus counselling service',
      },
      feedbackText: null,
      feedbackTextId: null,
    });
  });
});
