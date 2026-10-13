import type { OlbiDimension } from '../screening.types.js';

export interface OlbiItem {
  /** Item number 1-16, in the order shown to the student. */
  number: number;
  dimension: OlbiDimension;
  /**
   * 'negative' = the statement describes a burnout symptom
   *              (e.g. "I often feel emotionally drained").
   * 'positive' = the statement describes the absence of burnout
   *              (e.g. "When I study, I usually feel energised").
   */
  wording: 'positive' | 'negative';
}

/**
 * Item key for the 16-item OLBI (student version). Dimension and wording
 * match both the simulation document (codes D / DR / E / ER) and Campos et
 * al. (2012): the negatively worded items are 2, 3, 4, 6, 8, 9, 11, 12.
 */
export const OLBI_ITEMS: ReadonlyArray<OlbiItem> = [
  { number: 1, dimension: 'disengagement', wording: 'positive' },
  { number: 2, dimension: 'exhaustion', wording: 'negative' },
  { number: 3, dimension: 'disengagement', wording: 'negative' },
  { number: 4, dimension: 'exhaustion', wording: 'negative' },
  { number: 5, dimension: 'exhaustion', wording: 'positive' },
  { number: 6, dimension: 'disengagement', wording: 'negative' },
  { number: 7, dimension: 'disengagement', wording: 'positive' },
  { number: 8, dimension: 'exhaustion', wording: 'negative' },
  { number: 9, dimension: 'disengagement', wording: 'negative' },
  { number: 10, dimension: 'exhaustion', wording: 'positive' },
  { number: 11, dimension: 'disengagement', wording: 'negative' },
  { number: 12, dimension: 'exhaustion', wording: 'negative' },
  { number: 13, dimension: 'disengagement', wording: 'positive' },
  { number: 14, dimension: 'exhaustion', wording: 'positive' },
  { number: 15, dimension: 'disengagement', wording: 'positive' },
  { number: 16, dimension: 'exhaustion', wording: 'positive' },
];

/** Answer scale: 1 = Strongly Disagree ... 4 = Strongly Agree. */
export const OLBI_ANSWER_MIN = 1;
export const OLBI_ANSWER_MAX = 4;

/**
 * Cut-offs from Peterson et al. (2008): a dimension is High when its mean
 * score is >= 2.25 (exhaustion) or >= 2.1 (disengagement).
 *
 * TO CONFIRM: the thesis draft writes these as "> 2.25" and "> 2.1". The two
 * readings differ only for an exhaustion mean of exactly 2.25. Set
 * OLBI_CUTOFF_INCLUSIVE to false to use the strict ">" reading.
 */
export const OLBI_CUTOFFS: Record<OlbiDimension, number> = {
  exhaustion: 2.25,
  disengagement: 2.1,
};
export const OLBI_CUTOFF_INCLUSIVE = true;
