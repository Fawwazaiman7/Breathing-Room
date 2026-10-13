import { RECOMMENDATIONS } from '../screening/rule-engine/rule-base.js';
import type { InterventionLevel } from '../screening/rule-engine/rule-base.js';
import { getRuleById } from '../screening/rule-engine/rule-engine.js';
import {
  SCREENING_CATEGORIES,
  WORKLOAD_LEVELS,
} from '../screening/screening.types.js';
import type {
  BinaryLevel,
  ScreeningCategory,
  WorkloadLevel,
} from '../screening/screening.types.js';

/**
 * What an Academic Advisor (DPA) may see: the rule-based summary of each
 * advisee's screenings. Never the raw questionnaire answers, and never the
 * AI note written for the student.
 */

/** Columns read from public.profiles for an advisee. */
export interface AdviseeProfileRow {
  id: string;
  full_name: string;
  student_number: string | null;
  class_name: string | null;
}

/**
 * Columns read from public.screenings for the advisor views. Kept as an
 * explicit list so the raw answers never leave the database on this path.
 */
export const ADVISOR_SCREENING_COLUMNS = [
  'id',
  'student_id',
  'created_at',
  'category',
  'rule_id',
  'nasa_score',
  'workload_level',
  'exhaustion_score',
  'exhaustion_level',
  'disengagement_score',
  'disengagement_level',
  'intervention_level',
] as const;

export interface AdviseeScreeningRow {
  id: string;
  student_id: string;
  created_at: string;
  category: ScreeningCategory;
  rule_id: string;
  nasa_score: number;
  workload_level: WorkloadLevel;
  exhaustion_score: number;
  exhaustion_level: BinaryLevel;
  disengagement_score: number;
  disengagement_level: BinaryLevel;
  intervention_level: InterventionLevel;
}

export interface ScreeningSummary {
  id: string;
  createdAt: string;
  category: ScreeningCategory;
  ruleId: string;
  workload: { score: number; level: WorkloadLevel };
  exhaustion: { score: number; level: BinaryLevel };
  disengagement: { score: number; level: BinaryLevel };
  /** The validated action for this outcome. */
  recommendation: { id: string; en: string };
}

export interface AdviseeListItem {
  id: string;
  fullName: string;
  studentNumber: string | null;
  className: string | null;
  screeningCount: number;
  /** Most recent screening, or null if the student has not screened yet. */
  latest: ScreeningSummary | null;
}

export interface AdvisorOverview {
  totalStudents: number;
  screenedStudents: number;
  notScreened: number;
  /** Students whose latest result is Moderate or High risk. */
  needsFollowUp: number;
  /** Latest result per student, counted by category. */
  byCategory: Record<ScreeningCategory, number>;
  /** Latest result per student, counted by workload level. */
  byWorkload: Record<WorkloadLevel, number>;
  highExhaustion: number;
  highDisengagement: number;
}

export interface AdviseeDetail {
  student: {
    id: string;
    fullName: string;
    studentNumber: string | null;
    className: string | null;
  };
  latest: ScreeningSummary | null;
  /**
   * The psychologist's general rationale for the rule the latest screening
   * matched. It describes the rule, not this individual student.
   */
  latestRule: { id: string; rationale: { id: string; en: string } } | null;
  /** All screenings, newest first. */
  history: ScreeningSummary[];
}

/** Lower number = shown first. Students who need follow-up lead the list. */
const PRIORITY: Record<ScreeningCategory, number> = {
  HIGH_RISK: 0,
  MODERATE_RISK: 1,
  LOW_RISK: 2,
  NO_BURNOUT: 3,
};
const NOT_SCREENED_PRIORITY = 4;

export function toScreeningSummary(row: AdviseeScreeningRow): ScreeningSummary {
  return {
    id: row.id,
    createdAt: row.created_at,
    category: row.category,
    ruleId: row.rule_id,
    workload: { score: Number(row.nasa_score), level: row.workload_level },
    exhaustion: {
      score: Number(row.exhaustion_score),
      level: row.exhaustion_level,
    },
    disengagement: {
      score: Number(row.disengagement_score),
      level: row.disengagement_level,
    },
    recommendation: RECOMMENDATIONS[row.intervention_level],
  };
}

function newestFirst(a: AdviseeScreeningRow, b: AdviseeScreeningRow): number {
  return Date.parse(b.created_at) - Date.parse(a.created_at);
}

/**
 * One list item per advisee with their latest screening. Screenings of
 * anyone who is not in `profiles` are ignored.
 */
export function buildAdviseeList(
  profiles: AdviseeProfileRow[],
  screenings: AdviseeScreeningRow[],
): AdviseeListItem[] {
  const byStudent = new Map<string, AdviseeScreeningRow[]>();
  for (const profile of profiles) {
    byStudent.set(profile.id, []);
  }
  for (const row of screenings) {
    byStudent.get(row.student_id)?.push(row);
  }

  const items = profiles.map((profile): AdviseeListItem => {
    const rows = (byStudent.get(profile.id) ?? []).sort(newestFirst);
    return {
      id: profile.id,
      fullName: profile.full_name,
      studentNumber: profile.student_number,
      className: profile.class_name,
      screeningCount: rows.length,
      latest: rows.length > 0 ? toScreeningSummary(rows[0]) : null,
    };
  });

  return items.sort((a, b) => {
    const priorityA = a.latest ? PRIORITY[a.latest.category] : NOT_SCREENED_PRIORITY;
    const priorityB = b.latest ? PRIORITY[b.latest.category] : NOT_SCREENED_PRIORITY;
    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }
    return a.fullName.localeCompare(b.fullName);
  });
}

export function buildOverview(items: AdviseeListItem[]): AdvisorOverview {
  const byCategory = Object.fromEntries(
    SCREENING_CATEGORIES.map((category) => [category, 0]),
  ) as Record<ScreeningCategory, number>;
  const byWorkload = Object.fromEntries(
    WORKLOAD_LEVELS.map((level) => [level, 0]),
  ) as Record<WorkloadLevel, number>;

  let screenedStudents = 0;
  let highExhaustion = 0;
  let highDisengagement = 0;
  for (const item of items) {
    if (!item.latest) {
      continue;
    }
    screenedStudents += 1;
    byCategory[item.latest.category] += 1;
    byWorkload[item.latest.workload.level] += 1;
    if (item.latest.exhaustion.level === 'HIGH') {
      highExhaustion += 1;
    }
    if (item.latest.disengagement.level === 'HIGH') {
      highDisengagement += 1;
    }
  }

  return {
    totalStudents: items.length,
    screenedStudents,
    notScreened: items.length - screenedStudents,
    needsFollowUp: byCategory.HIGH_RISK + byCategory.MODERATE_RISK,
    byCategory,
    byWorkload,
    highExhaustion,
    highDisengagement,
  };
}

export function buildAdviseeDetail(
  profile: AdviseeProfileRow,
  screenings: AdviseeScreeningRow[],
): AdviseeDetail {
  const history = screenings
    .filter((row) => row.student_id === profile.id)
    .sort(newestFirst)
    .map(toScreeningSummary);
  const latest = history[0] ?? null;

  return {
    student: {
      id: profile.id,
      fullName: profile.full_name,
      studentNumber: profile.student_number,
      className: profile.class_name,
    },
    latest,
    latestRule: latest
      ? { id: latest.ruleId, rationale: getRuleById(latest.ruleId).rationale }
      : null,
    history,
  };
}
