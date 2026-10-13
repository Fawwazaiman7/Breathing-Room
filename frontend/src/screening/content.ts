import type {
  BinaryLevel,
  NasaTlxDimension,
  ScreeningCategory,
  WorkloadLevel,
} from './types';

/* -------------------------------------------------------------------------
 * NASA-TLX
 * ---------------------------------------------------------------------- */

export const NASA_TLX_DIMENSIONS: NasaTlxDimension[] = [
  'mentalDemand',
  'physicalDemand',
  'temporalDemand',
  'performance',
  'effort',
  'frustration',
];

/**
 * The 15 comparisons, in order.
 * MUST stay identical to NASA_TLX_PAIRS in the backend
 * (backend/src/screening/nasa-tlx/nasa-tlx.constants.ts): the backend reads
 * the answers by position.
 */
export const NASA_TLX_PAIRS: [NasaTlxDimension, NasaTlxDimension][] = [
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

export const DIMENSION_CONTENT: Record<
  NasaTlxDimension,
  { label: string; description: string; ratingQuestion: string }
> = {
  mentalDemand: {
    label: 'Mental load',
    description:
      'Thinking through code, solving problems, remembering details, or structuring a report.',
    ratingQuestion:
      'How much thinking, analysing, and problem-solving did your academic work demand?',
  },
  physicalDemand: {
    label: 'Physical fatigue',
    description:
      'For example, long periods at a computer, tired eyes, late nights, or too little rest.',
    ratingQuestion: 'How physically tiring was your academic work?',
  },
  temporalDemand: {
    label: 'Time pressure',
    description:
      'Feeling rushed by tight project deadlines, assignments piling up, or an approaching defence date.',
    ratingQuestion: 'How rushed or pressed for time did you feel?',
  },
  // Framed so that a higher rating means MORE workload, like the other five.
  performance: {
    label: 'Dissatisfaction with results',
    description:
      'Results falling short of what you hoped for, such as features that still have bugs or a report that still needs revisions.',
    ratingQuestion:
      'How dissatisfied were you with what you managed to achieve?',
  },
  effort: {
    label: 'Total effort',
    description:
      'The extra effort it took to keep up, such as staying up late or reading through a lot of documentation.',
    ratingQuestion:
      'How hard did you have to work, mentally and physically, to keep up?',
  },
  frustration: {
    label: 'Stress and frustration',
    description:
      'Feeling stressed, irritated, or discouraged, for example when code keeps failing or revisions never seem to end.',
    ratingQuestion: 'How stressed, irritated, or discouraged did you feel?',
  },
};

/* -------------------------------------------------------------------------
 * OLBI
 * ---------------------------------------------------------------------- */

/**
 * Which wording of the 16 statements students see.
 * 'id' is the validated Indonesian instrument (Pratama et al., 2025), as
 * listed in the system workflow document. 'en' is an English wording of the
 * same items for the English interface; it has not been validated with this
 * student population.
 */
export const OLBI_LANGUAGE: 'en' | 'id' = 'en';

/** Items 1-16 in order. Scoring is done by the backend, not here. */
export const OLBI_STATEMENTS: { en: string; id: string }[] = [
  {
    en: 'I always find new and interesting aspects in my studies.',
    id: 'Saya selalu menemukan hal yang menarik dan baru di kampus saya.',
  },
  {
    en: 'There are days when I feel tired before I arrive on campus.',
    id: 'Ada saatnya saya merasakan lelah sebelum sampai di kampus.',
  },
  {
    en: 'It happens more and more often that I talk about my studies in a negative way.',
    id: 'Sering kali saya membicarakan aktivitas akademik saya di kampus dengan cara negatif.',
  },
  {
    en: 'After classes, I tend to need more time than in the past in order to relax and feel better.',
    id: 'Setelah aktivitas kampus, saya membutuhkan waktu lebih lama untuk santai dan merasa nyaman dibandingkan sebelumnya.',
  },
  {
    en: 'I can tolerate the pressure of my studies very well.',
    id: 'Saya dapat menghadapi dengan baik tekanan-tekanan dalam aktivitas akademik di kampus.',
  },
  {
    en: 'Lately, I tend to think less about my studies and do my coursework almost mechanically.',
    id: 'Belakangan ini, saya cenderung malas berpikir dan menjalankan tugas hampir seperti robot.',
  },
  {
    en: 'I find my studies to be a positive challenge.',
    id: 'Saya merasa perkuliahan (aktivitas akademik) sebagai tantangan positif.',
  },
  {
    en: 'During my studies, I often feel emotionally drained.',
    id: 'Selama belajar saya sering merasa lelah secara emosional.',
  },
  {
    en: 'Over time, one can become disconnected from this type of study.',
    id: 'Lama kelamaan, kita bisa tidak sanggup lagi menjalankan aktivitas perkuliahan ini.',
  },
  {
    en: 'After studying, I have enough energy for my leisure activities.',
    id: 'Setelah perkuliahan, saya masih sanggup untuk melakukan aktivitas hobi saya.',
  },
  {
    en: 'Sometimes I feel sickened by my study tasks.',
    id: 'Terkadang saya merasa penat dengan tugas akademik dari kampus.',
  },
  {
    en: 'After studying, I usually feel worn out and weary.',
    id: 'Setelah belajar, biasanya saya merasa letih dan lelah.',
  },
  {
    en: 'This is the only field of study that I can imagine myself doing.',
    id: 'Ini adalah satu-satunya aktivitas yang saya yakini dapat saya lakukan.',
  },
  {
    en: 'Usually, I can manage the amount of my coursework well.',
    id: 'Biasanya, saya dapat mengatur porsi belajar saya dengan baik.',
  },
  {
    en: 'I feel more and more engaged in my studies.',
    id: 'Saya merasa semakin nyaman dengan aktivitas akademik saya.',
  },
  {
    en: 'When I study, I usually feel energised.',
    id: 'Ketika belajar, saya merasa bersemangat.',
  },
];

/** Answer values sent to the backend: 1 = Strongly disagree ... 4 = Strongly agree. */
export const OLBI_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Strongly disagree' },
  { value: 2, label: 'Disagree' },
  { value: 3, label: 'Agree' },
  { value: 4, label: 'Strongly agree' },
];

/* -------------------------------------------------------------------------
 * Results
 * ---------------------------------------------------------------------- */

export const CATEGORY_CONTENT: Record<
  ScreeningCategory,
  {
    label: string;
    tone: 'calm' | 'low' | 'moderate' | 'high';
    /** One short line for the history list. */
    short: string;
    summary: string;
    nextStep: string;
  }
> = {
  NO_BURNOUT: {
    label: 'No burnout',
    tone: 'calm',
    short: 'Things looked steady',
    summary:
      'Your answers suggest you are managing your academic workload well right now.',
    nextStep:
      'The recommended step is self-guided: keep the routines for rest, planning, and pacing that are working for you, and check in again later in the semester.',
  },
  LOW_RISK: {
    label: 'Low risk',
    tone: 'low',
    short: 'Workload was manageable',
    summary:
      'Your workload is heavy at the moment, but your answers suggest you are coping with it.',
    nextStep:
      'The recommended step is self-guided: protect your rest, break large tasks into smaller ones, and pace yourself so the load stays manageable.',
  },
  MODERATE_RISK: {
    label: 'Moderate risk',
    tone: 'moderate',
    short: 'Some signs of exhaustion',
    summary:
      'Your answers show signs of exhaustion that are worth paying attention to.',
    nextStep:
      'We recommend arranging a conversation with your Academic Advisor (DPA) about your workload and how you have been feeling.',
  },
  HIGH_RISK: {
    label: 'High risk',
    tone: 'high',
    short: 'Extra support recommended',
    summary:
      'Your answers suggest things have been really hard lately. You do not have to handle this alone.',
    nextStep:
      'We recommend speaking with a counsellor at the PNJ Counselling Unit (BK PNJ). Your Academic Advisor (DPA) can help you arrange it.',
  },
};

export const WORKLOAD_LABELS: Record<WorkloadLevel, string> = {
  VERY_LOW: 'Very low',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  VERY_HIGH: 'Very high',
};

export const BINARY_LABELS: Record<BinaryLevel, string> = {
  LOW: 'Low',
  HIGH: 'High',
};
