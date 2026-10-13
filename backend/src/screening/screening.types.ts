/**
 * Shared types for the screening core.
 *
 * Everything in this folder except the Nest files (module, controller,
 * service, dto) is plain TypeScript with no framework dependency, so the
 * scoring and rule logic can be unit-tested in isolation.
 */

export const NASA_TLX_DIMENSIONS = [
  'mentalDemand',
  'physicalDemand',
  'temporalDemand',
  'performance',
  'effort',
  'frustration',
] as const;
export type NasaTlxDimension = (typeof NASA_TLX_DIMENSIONS)[number];

/**
 * Workload levels as named in the psychologist-validated rule table
 * (Sangat Rendah, Rendah, Sedang, Tinggi, Sangat Tinggi).
 */
export const WORKLOAD_LEVELS = [
  'VERY_LOW',
  'LOW',
  'MODERATE',
  'HIGH',
  'VERY_HIGH',
] as const;
export type WorkloadLevel = (typeof WORKLOAD_LEVELS)[number];

export const BINARY_LEVELS = ['LOW', 'HIGH'] as const;
export type BinaryLevel = (typeof BINARY_LEVELS)[number];

export const SCREENING_CATEGORIES = [
  'NO_BURNOUT',
  'LOW_RISK',
  'MODERATE_RISK',
  'HIGH_RISK',
] as const;
export type ScreeningCategory = (typeof SCREENING_CATEGORIES)[number];

export const OLBI_DIMENSIONS = ['exhaustion', 'disengagement'] as const;
export type OlbiDimension = (typeof OLBI_DIMENSIONS)[number];

/** Thrown when questionnaire input is incomplete or out of range. */
export class ScreeningInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ScreeningInputError';
  }
}

export function round2(value: number): number {
  return Math.round(value * 100) / 100;
}
