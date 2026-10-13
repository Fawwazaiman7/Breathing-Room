import { ScreeningInputError } from '../screening.types.js';
import type { NasaTlxDimension } from '../screening.types.js';
import {
  calculateNasaTlx,
  calculateWeights,
  classifyWorkload,
} from './nasa-tlx.calculator.js';
import { NASA_TLX_PAIRS } from './nasa-tlx.constants.js';

/** "Mahasiswa Contoh A" from section 7 of the simulation document. */
const EXAMPLE_CHOICES: NasaTlxDimension[] = [
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
];
const EXAMPLE_RATINGS: Record<NasaTlxDimension, number> = {
  mentalDemand: 70,
  physicalDemand: 40,
  temporalDemand: 50,
  performance: 60,
  effort: 65,
  frustration: 55,
};

describe('NASA-TLX calculator', () => {
  it('has 15 unique pairs covering every dimension five times', () => {
    expect(NASA_TLX_PAIRS).toHaveLength(15);
    const keys = new Set(NASA_TLX_PAIRS.map((pair) => [...pair].sort().join()));
    expect(keys.size).toBe(15);
    const appearances: Record<string, number> = {};
    for (const [a, b] of NASA_TLX_PAIRS) {
      expect(a).not.toBe(b);
      appearances[a] = (appearances[a] ?? 0) + 1;
      appearances[b] = (appearances[b] ?? 0) + 1;
    }
    expect(Object.values(appearances)).toEqual([5, 5, 5, 5, 5, 5]);
  });

  it('reproduces the worked example (WWL 895, score 59.67, High)', () => {
    const result = calculateNasaTlx({
      pairwiseChoices: EXAMPLE_CHOICES,
      ratings: EXAMPLE_RATINGS,
    });
    expect(result.weights).toEqual({
      mentalDemand: 4,
      physicalDemand: 2,
      temporalDemand: 1,
      performance: 3,
      effort: 3,
      frustration: 2,
    });
    expect(result.products).toEqual({
      mentalDemand: 280,
      physicalDemand: 80,
      temporalDemand: 50,
      performance: 180,
      effort: 195,
      frustration: 110,
    });
    expect(result.weightedWorkload).toBe(895);
    expect(result.score).toBe(59.67);
    expect(result.level).toBe('HIGH');
  });

  it('always produces weights that sum to 15', () => {
    const allFirst = NASA_TLX_PAIRS.map(([a]) => a);
    const allSecond = NASA_TLX_PAIRS.map(([, b]) => b);
    for (const choices of [allFirst, allSecond, EXAMPLE_CHOICES]) {
      const weights = calculateWeights(choices);
      const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
      expect(total).toBe(15);
    }
  });

  it('classifies band edges', () => {
    const cases: Array<[number, string]> = [
      [0, 'VERY_LOW'],
      [9, 'VERY_LOW'],
      [9.99, 'VERY_LOW'],
      [10, 'LOW'],
      [29.99, 'LOW'],
      [30, 'MODERATE'],
      [49.99, 'MODERATE'],
      [50, 'HIGH'],
      [79.99, 'HIGH'],
      [80, 'VERY_HIGH'],
      [100, 'VERY_HIGH'],
    ];
    for (const [score, level] of cases) {
      expect(classifyWorkload(score)).toBe(level);
    }
  });

  it('gives the extremes: all ratings 0 -> 0, all ratings 100 -> 100', () => {
    const zero = { ...EXAMPLE_RATINGS };
    const full = { ...EXAMPLE_RATINGS };
    for (const key of Object.keys(zero) as NasaTlxDimension[]) {
      zero[key] = 0;
      full[key] = 100;
    }
    expect(
      calculateNasaTlx({ pairwiseChoices: EXAMPLE_CHOICES, ratings: zero })
        .score,
    ).toBe(0);
    expect(
      calculateNasaTlx({ pairwiseChoices: EXAMPLE_CHOICES, ratings: full })
        .score,
    ).toBe(100);
  });

  it('rejects a wrong number of choices', () => {
    expect(() => calculateWeights(EXAMPLE_CHOICES.slice(0, 14))).toThrow(
      ScreeningInputError,
    );
  });

  it('rejects a choice that is not one of the two options in that pair', () => {
    const choices = [...EXAMPLE_CHOICES];
    choices[0] = 'frustration'; // pair 1 is mentalDemand vs physicalDemand
    expect(() => calculateWeights(choices)).toThrow(ScreeningInputError);
  });

  it('rejects out-of-range or missing ratings', () => {
    expect(() =>
      calculateNasaTlx({
        pairwiseChoices: EXAMPLE_CHOICES,
        ratings: { ...EXAMPLE_RATINGS, effort: 101 },
      }),
    ).toThrow(ScreeningInputError);
    expect(() =>
      calculateNasaTlx({
        pairwiseChoices: EXAMPLE_CHOICES,
        ratings: { ...EXAMPLE_RATINGS, effort: -1 },
      }),
    ).toThrow(ScreeningInputError);
    const missing = { ...EXAMPLE_RATINGS } as Record<string, number>;
    delete missing.effort;
    expect(() =>
      calculateNasaTlx({
        pairwiseChoices: EXAMPLE_CHOICES,
        ratings: missing as Record<NasaTlxDimension, number>,
      }),
    ).toThrow(ScreeningInputError);
  });
});
