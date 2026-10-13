import type {
  BinaryLevel,
  Recommendation,
  ScreeningCategory,
  WorkloadLevel,
} from '../screening/types';

/** One screening as an advisor sees it: the rule-based summary only. */
export interface ScreeningSummary {
  id: string;
  createdAt: string;
  category: ScreeningCategory;
  ruleId: string;
  workload: { score: number; level: WorkloadLevel };
  exhaustion: { score: number; level: BinaryLevel };
  disengagement: { score: number; level: BinaryLevel };
  recommendation: Recommendation;
}

export interface AdviseeListItem {
  id: string;
  fullName: string;
  studentNumber: string | null;
  className: string | null;
  screeningCount: number;
  latest: ScreeningSummary | null;
}

export interface AdvisorOverview {
  totalStudents: number;
  screenedStudents: number;
  notScreened: number;
  needsFollowUp: number;
  byCategory: Record<ScreeningCategory, number>;
  byWorkload: Record<WorkloadLevel, number>;
  highExhaustion: number;
  highDisengagement: number;
}

/** Response of GET /advisor/students. */
export interface AdvisorDashboard {
  overview: AdvisorOverview;
  students: AdviseeListItem[];
}

/** Response of GET /advisor/students/:id. */
export interface AdviseeDetail {
  student: {
    id: string;
    fullName: string;
    studentNumber: string | null;
    className: string | null;
  };
  latest: ScreeningSummary | null;
  latestRule: { id: string; rationale: { id: string; en: string } } | null;
  history: ScreeningSummary[];
}
