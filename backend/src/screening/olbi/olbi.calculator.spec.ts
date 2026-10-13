import { ScreeningInputError } from '../screening.types.js';
import {
  calculateOlbi,
  classifyOlbiDimension,
  scoreOlbiItem,
} from './olbi.calculator.js';
import { OLBI_ITEMS } from './olbi.constants.js';

/** Builds 16 answers from one answer for negative items and one for positive. */
function answersFor(negative: number, positive: number): number[] {
  return OLBI_ITEMS.map((item) =>
    item.wording === 'negative' ? negative : positive,
  );
}

describe('OLBI calculator', () => {
  it('has 8 items per dimension, 4 positive and 4 negative each', () => {
    expect(OLBI_ITEMS).toHaveLength(16);
    expect(OLBI_ITEMS.map((item) => item.number)).toEqual(
      Array.from({ length: 16 }, (_, i) => i + 1),
    );
    for (const dimension of ['exhaustion', 'disengagement'] as const) {
      const items = OLBI_ITEMS.filter((item) => item.dimension === dimension);
      expect(items).toHaveLength(8);
      expect(items.filter((i) => i.wording === 'negative')).toHaveLength(4);
    }
    expect(
      OLBI_ITEMS.filter((i) => i.wording === 'negative').map((i) => i.number),
    ).toEqual([2, 3, 4, 6, 8, 9, 11, 12]);
  });

  it('scores so that a higher score means more burnout', () => {
    const negative = OLBI_ITEMS[1]; // item 2: "tired before arriving on campus"
    const positive = OLBI_ITEMS[0]; // item 1: "always find new and interesting things"
    expect(scoreOlbiItem(negative, 4)).toBe(4); // strongly agree with a symptom
    expect(scoreOlbiItem(negative, 1)).toBe(1);
    expect(scoreOlbiItem(positive, 4)).toBe(1); // strongly agree with engagement
    expect(scoreOlbiItem(positive, 1)).toBe(4);
  });

  it('gives the maximum for a fully burned-out answer pattern', () => {
    const result = calculateOlbi(answersFor(4, 1));
    expect(result.exhaustion).toEqual({ score: 4, level: 'HIGH' });
    expect(result.disengagement).toEqual({ score: 4, level: 'HIGH' });
  });

  it('gives the minimum for a fully engaged answer pattern', () => {
    const result = calculateOlbi(answersFor(1, 4));
    expect(result.exhaustion).toEqual({ score: 1, level: 'LOW' });
    expect(result.disengagement).toEqual({ score: 1, level: 'LOW' });
  });

  it('scores the worked-example answers from the simulation document', () => {
    // Raw answers of "Mahasiswa Contoh A", items 1-16.
    const answers = [2, 2, 3, 2, 3, 3, 3, 3, 4, 4, 3, 3, 2, 3, 3, 2];
    const result = calculateOlbi(answers);
    // Exhaustion items 2,4,5,8,10,12,14,16 -> 2+2+2+3+1+3+2+3 = 18 -> 2.25
    expect(result.exhaustion.score).toBe(2.25);
    // Disengagement items 1,3,6,7,9,11,13,15 -> 3+3+3+2+4+3+3+2 = 23 -> 2.875
    expect(result.disengagement.score).toBe(2.88);
    expect(result.disengagement.level).toBe('HIGH');
    // 2.25 sits exactly on the cut-off: High under ">=", Low under ">".
    expect(result.exhaustion.level).toBe('HIGH');
  });

  it('applies the cut-offs (>= 2.25 exhaustion, >= 2.1 disengagement)', () => {
    expect(classifyOlbiDimension('exhaustion', 2.125)).toBe('LOW');
    expect(classifyOlbiDimension('exhaustion', 2.25)).toBe('HIGH');
    expect(classifyOlbiDimension('exhaustion', 2.375)).toBe('HIGH');
    expect(classifyOlbiDimension('disengagement', 2)).toBe('LOW');
    expect(classifyOlbiDimension('disengagement', 2.125)).toBe('HIGH');
  });

  it('rejects incomplete or out-of-range answers', () => {
    expect(() => calculateOlbi(answersFor(2, 2).slice(0, 15))).toThrow(
      ScreeningInputError,
    );
    for (const bad of [0, 5, 2.5, Number.NaN]) {
      const answers = answersFor(2, 2);
      answers[7] = bad;
      expect(() => calculateOlbi(answers)).toThrow(ScreeningInputError);
    }
  });
});
