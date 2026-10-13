import type {
  BinaryLevel,
  ScreeningCategory,
  WorkloadLevel,
} from '../screening.types.js';

export type InterventionLevel = 'PROMOTIVE' | 'PREVENTIVE' | 'CURATIVE';

export interface Rule {
  /** R1 ... R20, as numbered in the validated rule table. */
  id: string;
  workload: WorkloadLevel;
  exhaustion: BinaryLevel;
  disengagement: BinaryLevel;
  category: ScreeningCategory;
  interventionLevel: InterventionLevel;
  /**
   * Psychologist's rationale. Internal context for the LLM feedback prompt
   * and the advisor view. Written in clinical terms, so do not show it to
   * students verbatim.
   */
  rationale: { id: string; en: string };
}

/**
 * Recommended action per intervention level.
 * `id` is the validated wording; `en` is a working translation for the
 * English UI and should be reviewed before release.
 */
export const RECOMMENDATIONS: Record<
  InterventionLevel,
  { id: string; en: string }
> = {
  PROMOTIVE: {
    id: 'Promotif dengan Edukasi self-help mandiri',
    en: 'Promotive: independent self-help education',
  },
  PREVENTIVE: {
    id: 'Preventif dengan konsultasi bersama dosen PA',
    en: 'Preventive: consultation with your Academic Advisor (DPA)',
  },
  CURATIVE: {
    id: 'Kuratif dengan rujukan konseling ke BK PNJ',
    en: 'Curative: counselling referral to the PNJ Counselling Unit (BK PNJ)',
  },
};

/**
 * The 20 IF-THEN rules, transcribed from the psychologist-validated table
 * ("Tabel Rule Base - Simulasi Alur Kerja Penelitian").
 *
 * This table is the authoritative decision source. Do not edit an outcome
 * without the psychologist's sign-off. The `rationale.id` strings are the
 * validated wording; `rationale.en` is a working translation.
 */
export const RULE_BASE: ReadonlyArray<Rule> = [
  // Exhaustion LOW, Disengagement LOW
  {
    id: 'R1',
    workload: 'VERY_LOW',
    exhaustion: 'LOW',
    disengagement: 'LOW',
    category: 'NO_BURNOUT',
    interventionLevel: 'PROMOTIVE',
    rationale: {
      id: 'Mahasiswa di zona calm menilai tugas tanpa ancaman; resources cukup dan kinerja stabil tanpa lelah.',
      en: 'Student is in the calm zone and appraises tasks as non-threatening; resources are sufficient and performance is stable without fatigue.',
    },
  },
  {
    id: 'R2',
    workload: 'LOW',
    exhaustion: 'LOW',
    disengagement: 'LOW',
    category: 'NO_BURNOUT',
    interventionLevel: 'PROMOTIVE',
    rationale: {
      id: 'Mahasiswa di zona calm memandang beban ringan dengan coping efektif, sehingga kuliah berjalan aman.',
      en: 'Student is in the calm zone and views the load as light with effective coping, so studies proceed safely.',
    },
  },
  {
    id: 'R3',
    workload: 'MODERATE',
    exhaustion: 'LOW',
    disengagement: 'LOW',
    category: 'NO_BURNOUT',
    interventionLevel: 'PROMOTIVE',
    rationale: {
      id: 'Mahasiswa menilai beban standar sebagai tantangan (eustress); ia fokus, berenergi, dan tampil optimal.',
      en: 'Student appraises a standard load as a challenge (eustress); focused, energised, and performing optimally.',
    },
  },
  {
    id: 'R4',
    workload: 'HIGH',
    exhaustion: 'LOW',
    disengagement: 'LOW',
    category: 'LOW_RISK',
    interventionLevel: 'PROMOTIVE',
    rationale: {
      id: 'Mahasiswa tangguh menahan beban tinggi (problem-focused); mulai masuk fase fatigue namun belum kolaps.',
      en: 'Student is resilient under a high load (problem-focused coping); entering the fatigue phase but not yet collapsing.',
    },
  },
  {
    id: 'R5',
    workload: 'VERY_HIGH',
    exhaustion: 'LOW',
    disengagement: 'LOW',
    category: 'LOW_RISK',
    interventionLevel: 'PROMOTIVE',
    rationale: {
      id: 'Mahasiswa dihantam stresor ekstrem mendekati distress, namun sumber daya coping masih tangguh bertahan.',
      en: 'Student faces extreme stressors approaching distress, but coping resources are still holding.',
    },
  },

  // Exhaustion HIGH, Disengagement LOW
  {
    id: 'R6',
    workload: 'VERY_LOW',
    exhaustion: 'HIGH',
    disengagement: 'LOW',
    category: 'MODERATE_RISK',
    interventionLevel: 'PREVENTIVE',
    rationale: {
      id: 'Mahasiswa exhausted di zona bored; kegagalan koping ini murni dipicu krisis personal non-akademik.',
      en: 'Student is exhausted while in the bored zone; this coping failure is driven purely by a personal, non-academic crisis.',
    },
  },
  {
    id: 'R7',
    workload: 'LOW',
    exhaustion: 'HIGH',
    disengagement: 'LOW',
    category: 'MODERATE_RISK',
    interventionLevel: 'PREVENTIVE',
    rationale: {
      id: 'Mahasiswa kelelahan (fatigue) pada tugas ringan akibat defisit resources internal (seperti manajemen waktu).',
      en: 'Student is fatigued by light tasks due to a deficit in internal resources (such as time management).',
    },
  },
  {
    id: 'R8',
    workload: 'MODERATE',
    exhaustion: 'HIGH',
    disengagement: 'LOW',
    category: 'MODERATE_RISK',
    interventionLevel: 'PREVENTIVE',
    rationale: {
      id: 'Mahasiswa gagal merespons eustress pada beban standar akibat defisit resources, memicu awal distress.',
      en: 'Student fails to respond to eustress under a standard load due to a resource deficit, triggering early distress.',
    },
  },
  {
    id: 'R9',
    workload: 'HIGH',
    exhaustion: 'HIGH',
    disengagement: 'LOW',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa menilai tugas sebagai ancaman (threat); coping kewalahan, memicu distress dan kelelahan akut.',
      en: 'Student appraises tasks as a threat; coping is overwhelmed, triggering distress and acute exhaustion.',
    },
  },
  {
    id: 'R10',
    workload: 'VERY_HIGH',
    exhaustion: 'HIGH',
    disengagement: 'LOW',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa kolaps di bawah beban ekstrem; koping hancur instan yang memicu severe distress (kritis).',
      en: 'Student collapses under an extreme load; coping breaks down immediately, triggering severe distress (critical).',
    },
  },

  // Exhaustion LOW, Disengagement HIGH
  {
    id: 'R11',
    workload: 'VERY_LOW',
    exhaustion: 'LOW',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa di zona bored menilai kuliah tidak relevan, memicu emotion-focused coping berupa apatis total.',
      en: 'Student in the bored zone sees coursework as irrelevant, triggering emotion-focused coping in the form of total apathy.',
    },
  },
  {
    id: 'R12',
    workload: 'LOW',
    exhaustion: 'LOW',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa kurang mendapat eustress pada beban ringan, lalu merespons dengan sikap sinis dan penarikan diri.',
      en: 'Student gets too little eustress from a light load and responds with cynicism and withdrawal.',
    },
  },
  {
    id: 'R13',
    workload: 'MODERATE',
    exhaustion: 'LOW',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa gagal mengelola beban standar dan mengamankan mentalnya (emotion-focused) lewat sikap apatis.',
      en: 'Student fails to manage a standard load and protects themselves mentally (emotion-focused) through apathy.',
    },
  },
  {
    id: 'R14',
    workload: 'HIGH',
    exhaustion: 'LOW',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa terancam (threat) oleh tugas berat dan memilih pelarian instan dengan melepaskan diri dari kuliah.',
      en: 'Student feels threatened by heavy tasks and chooses an instant escape by detaching from their studies.',
    },
  },
  {
    id: 'R15',
    workload: 'VERY_HIGH',
    exhaustion: 'LOW',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa memblokir ancaman stresor ekstrem dengan penolakan penuh demi mencegah breakdown lebih dalam.',
      en: 'Student blocks out the threat of extreme stressors through full rejection to prevent a deeper breakdown.',
    },
  },

  // Exhaustion HIGH, Disengagement HIGH
  {
    id: 'R16',
    workload: 'VERY_LOW',
    exhaustion: 'HIGH',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa mengalami breakdown pada tugas ringan karena pertahanan koping lumpuh oleh tekanan personal.',
      en: 'Student experiences a breakdown on light tasks because coping defences are paralysed by personal pressure.',
    },
  },
  {
    id: 'R17',
    workload: 'LOW',
    exhaustion: 'HIGH',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa kolaps (distress kronis) pada tugas ringan akibat terkuras habisnya seluruh sumber daya coping.',
      en: 'Student collapses (chronic distress) on light tasks because all coping resources are fully depleted.',
    },
  },
  {
    id: 'R18',
    workload: 'MODERATE',
    exhaustion: 'HIGH',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa gagal merespons eustress; resources yang habis memicu darurat mental ganda (lelah dan apatis).',
      en: 'Student fails to respond to eustress; depleted resources trigger a double mental emergency (exhausted and apathetic).',
    },
  },
  {
    id: 'R19',
    workload: 'HIGH',
    exhaustion: 'HIGH',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa dihancurkan rentetan stresor tinggi yang mempercepat puncak distress menjadi sindrom penuh.',
      en: 'Student is overwhelmed by a series of high stressors that accelerates peak distress into the full syndrome.',
    },
  },
  {
    id: 'R20',
    workload: 'VERY_HIGH',
    exhaustion: 'HIGH',
    disengagement: 'HIGH',
    category: 'HIGH_RISK',
    interventionLevel: 'CURATIVE',
    rationale: {
      id: 'Mahasiswa kehilangan seluruh sistem pertahanan coping akibat stresor ekstrem, memuncak pada breakdown absolut.',
      en: 'Student loses the entire coping defence system due to extreme stressors, culminating in an absolute breakdown.',
    },
  },
];
