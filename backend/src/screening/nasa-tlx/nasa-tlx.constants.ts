import type { NasaTlxDimension, WorkloadLevel } from '../screening.types.js';

/**
 * The 15 pairwise comparisons, C(6,2), in the order shown to the student.
 * Order follows section 3.3 of the system workflow simulation document.
 */
export const NASA_TLX_PAIRS: ReadonlyArray<
  readonly [NasaTlxDimension, NasaTlxDimension]
> = [
  ['mentalDemand', 'physicalDemand'],
  ['mentalDemand', 'temporalDemand'],
  ['mentalDemand', 'performance'],
  ['mentalDemand', 'effort'],
  ['mentalDemand', 'frustration'],
  ['physicalDemand', 'temporalDemand'],
  ['physicalDemand', 'performance'],
  ['physicalDemand', 'effort'],
  ['physicalDemand', 'frustration'],
  ['temporalDemand', 'performance'],
  ['temporalDemand', 'effort'],
  ['temporalDemand', 'frustration'],
  ['performance', 'effort'],
  ['performance', 'frustration'],
  ['effort', 'frustration'],
];

export const NASA_TLX_RATING_MIN = 0;
export const NASA_TLX_RATING_MAX = 100;

/** Divisor for the average score: the total of all weights is always 15. */
export const NASA_TLX_TOTAL_WEIGHT = NASA_TLX_PAIRS.length;

/**
 * Score bands for the average Weighted Workload score (0-100).
 *
 * ASSUMPTION TO CONFIRM: the score ranges come from the simulation document
 * (0-9, 10-29, 30-49, 50-79, 80-100, labelled Rendah / Sedang / Agak Tinggi /
 * Tinggi / Sangat Tinggi), while the validated rule table names its five
 * levels Sangat Rendah / Rendah / Sedang / Tinggi / Sangat Tinggi. The bands
 * are mapped to the rule-table levels by position (lowest band = VERY_LOW).
 * This only changes outcomes for the 30-49 band: here it is MODERATE
 * (rules R3, R8, R13, R18). If the psychologist intended 30-49 to behave as
 * HIGH, change `level` on that band and nothing else.
 *
 * A band applies when score >= min and below the next band's min, so
 * fractional scores such as 9.67 or 29.5 stay in the lower band.
 */
export const WORKLOAD_BANDS: ReadonlyArray<{
  level: WorkloadLevel;
  min: number;
}> = [
  { level: 'VERY_LOW', min: 0 },
  { level: 'LOW', min: 10 },
  { level: 'MODERATE', min: 30 },
  { level: 'HIGH', min: 50 },
  { level: 'VERY_HIGH', min: 80 },
];
