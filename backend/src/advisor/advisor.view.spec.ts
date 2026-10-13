import {
  ADVISOR_SCREENING_COLUMNS,
  buildAdviseeDetail,
  buildAdviseeList,
  buildOverview,
} from './advisor.view.js';
import type { AdviseeProfileRow, AdviseeScreeningRow } from './advisor.view.js';

const profile = (id: string, name: string): AdviseeProfileRow => ({
  id,
  full_name: name,
  student_number: `23074130${id.slice(-2)}`,
  class_name: 'TI 6A',
});

function screening(
  id: string,
  studentId: string,
  date: string,
  ruleId: string,
  category: AdviseeScreeningRow['category'],
  workload: AdviseeScreeningRow['workload_level'],
  exhaustion: 'LOW' | 'HIGH',
  disengagement: 'LOW' | 'HIGH',
  intervention: AdviseeScreeningRow['intervention_level'],
): AdviseeScreeningRow {
  return {
    id,
    student_id: studentId,
    created_at: date,
    category,
    rule_id: ruleId,
    nasa_score: 59.67,
    workload_level: workload,
    exhaustion_score: exhaustion === 'HIGH' ? 3 : 1.75,
    exhaustion_level: exhaustion,
    disengagement_score: disengagement === 'HIGH' ? 3 : 1.63,
    disengagement_level: disengagement,
    intervention_level: intervention,
  };
}

const PROFILES = [
  profile('s-01', 'Citra'),
  profile('s-02', 'Andi'),
  profile('s-03', 'Bima'),
  profile('s-04', 'Dewi'),
  profile('s-05', 'Eka'),
];

const SCREENINGS = [
  // Citra: was High risk in September, No burnout now. Latest must win.
  screening('a1', 's-01', '2026-09-01T02:00:00Z', 'R19', 'HIGH_RISK', 'HIGH', 'HIGH', 'HIGH', 'CURATIVE'),
  screening('a2', 's-01', '2026-10-10T02:00:00Z', 'R2', 'NO_BURNOUT', 'LOW', 'LOW', 'LOW', 'PROMOTIVE'),
  // Andi: Moderate risk.
  screening('b1', 's-02', '2026-10-09T02:00:00Z', 'R8', 'MODERATE_RISK', 'MODERATE', 'HIGH', 'LOW', 'PREVENTIVE'),
  // Bima: High risk (disengagement only).
  screening('c1', 's-03', '2026-10-08T02:00:00Z', 'R14', 'HIGH_RISK', 'HIGH', 'LOW', 'HIGH', 'CURATIVE'),
  // Dewi: Low risk.
  screening('d1', 's-04', '2026-10-07T02:00:00Z', 'R5', 'LOW_RISK', 'VERY_HIGH', 'LOW', 'LOW', 'PROMOTIVE'),
  // Eka: no screening. Plus a row for someone who is not an advisee.
  screening('x1', 's-99', '2026-10-11T02:00:00Z', 'R20', 'HIGH_RISK', 'VERY_HIGH', 'HIGH', 'HIGH', 'CURATIVE'),
];

describe('Advisor views', () => {
  it('never selects raw questionnaire answers or the AI note', () => {
    const columns: readonly string[] = ADVISOR_SCREENING_COLUMNS;
    for (const forbidden of [
      'nasa_pairwise_choices',
      'nasa_ratings',
      'nasa_weights',
      'olbi_answers',
      'feedback_text',
    ]) {
      expect(columns.includes(forbidden)).toBe(false);
    }
  });

  it('lists each advisee once with their latest screening, most urgent first', () => {
    const list = buildAdviseeList(PROFILES, SCREENINGS);
    expect(list.map((item) => `${item.fullName}:${item.latest?.category ?? 'none'}`)).toEqual([
      'Bima:HIGH_RISK',
      'Andi:MODERATE_RISK',
      'Dewi:LOW_RISK',
      'Citra:NO_BURNOUT',
      'Eka:none',
    ]);
    const citra = list.find((item) => item.fullName === 'Citra')!;
    expect(citra.screeningCount).toBe(2);
    expect(citra.latest?.id).toBe('a2');
    expect(list.find((item) => item.fullName === 'Eka')).toEqual({
      id: 's-05',
      fullName: 'Eka',
      studentNumber: '2307413005',
      className: 'TI 6A',
      screeningCount: 0,
      latest: null,
    });
  });

  it('orders students with the same category by name', () => {
    const list = buildAdviseeList(
      [profile('s-11', 'Zaki'), profile('s-12', 'Ayu')],
      [
        screening('z', 's-11', '2026-10-01T00:00:00Z', 'R9', 'HIGH_RISK', 'HIGH', 'HIGH', 'LOW', 'CURATIVE'),
        screening('y', 's-12', '2026-10-02T00:00:00Z', 'R9', 'HIGH_RISK', 'HIGH', 'HIGH', 'LOW', 'CURATIVE'),
      ],
    );
    expect(list.map((item) => item.fullName)).toEqual(['Ayu', 'Zaki']);
  });

  it('maps a screening row to the summary shown to the advisor', () => {
    const bima = buildAdviseeList(PROFILES, SCREENINGS)[0];
    expect(bima.latest).toEqual({
      id: 'c1',
      createdAt: '2026-10-08T02:00:00Z',
      category: 'HIGH_RISK',
      ruleId: 'R14',
      workload: { score: 59.67, level: 'HIGH' },
      exhaustion: { score: 1.75, level: 'LOW' },
      disengagement: { score: 3, level: 'HIGH' },
      recommendation: {
        id: 'Kuratif dengan rujukan konseling ke BK PNJ',
        en: 'Curative: counselling referral to the PNJ Counselling Unit (BK PNJ)',
      },
    });
  });

  it('counts the overview from each student’s latest result only', () => {
    expect(buildOverview(buildAdviseeList(PROFILES, SCREENINGS))).toEqual({
      totalStudents: 5,
      screenedStudents: 4,
      notScreened: 1,
      needsFollowUp: 2,
      byCategory: { NO_BURNOUT: 1, LOW_RISK: 1, MODERATE_RISK: 1, HIGH_RISK: 1 },
      byWorkload: { VERY_LOW: 0, LOW: 1, MODERATE: 1, HIGH: 1, VERY_HIGH: 1 },
      highExhaustion: 1,
      highDisengagement: 1,
    });
  });

  it('handles an advisor with no students', () => {
    expect(buildAdviseeList([], SCREENINGS)).toEqual([]);
    expect(buildOverview([])).toEqual({
      totalStudents: 0,
      screenedStudents: 0,
      notScreened: 0,
      needsFollowUp: 0,
      byCategory: { NO_BURNOUT: 0, LOW_RISK: 0, MODERATE_RISK: 0, HIGH_RISK: 0 },
      byWorkload: { VERY_LOW: 0, LOW: 0, MODERATE: 0, HIGH: 0, VERY_HIGH: 0 },
      highExhaustion: 0,
      highDisengagement: 0,
    });
  });

  it('builds a student detail with history newest first and the rule rationale', () => {
    const detail = buildAdviseeDetail(PROFILES[0], SCREENINGS);
    expect(detail.student).toEqual({
      id: 's-01',
      fullName: 'Citra',
      studentNumber: '2307413001',
      className: 'TI 6A',
    });
    expect(detail.history.map((entry) => entry.id)).toEqual(['a2', 'a1']);
    expect(detail.latest?.category).toBe('NO_BURNOUT');
    expect(detail.latestRule).toEqual({
      id: 'R2',
      rationale: {
        id: 'Mahasiswa di zona calm memandang beban ringan dengan coping efektif, sehingga kuliah berjalan aman.',
        en: 'Student is in the calm zone and views the load as light with effective coping, so studies proceed safely.',
      },
    });
  });

  it('builds a detail for a student who has not screened', () => {
    const detail = buildAdviseeDetail(PROFILES[4], SCREENINGS);
    expect(detail.latest).toBe(null);
    expect(detail.latestRule).toBe(null);
    expect(detail.history).toEqual([]);
  });
});
