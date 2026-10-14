import type {
  BinaryLevel,
  ScreeningCategory,
  WorkloadLevel,
} from '../screening/screening.types.js';
import type { FeedbackContext } from './feedback.context.js';

export interface ChatMessage {
  /** 'assistant' is used by the Support Chat for earlier replies. */
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export const CATEGORY_LABELS: Record<ScreeningCategory, string> = {
  NO_BURNOUT: 'No burnout',
  LOW_RISK: 'Low burnout risk',
  MODERATE_RISK: 'Moderate burnout risk',
  HIGH_RISK: 'High burnout risk',
};

export const WORKLOAD_LABELS: Record<WorkloadLevel, string> = {
  VERY_LOW: 'Very low',
  LOW: 'Low',
  MODERATE: 'Moderate',
  HIGH: 'High',
  VERY_HIGH: 'Very high',
};

export const BINARY_LABELS: Record<BinaryLevel, string> = { LOW: 'Low', HIGH: 'High' };

/**
 * The LLM explains a decision; it never makes one. The category and the
 * recommended action come from the rule base and are passed in as fixed
 * facts. feedback.checker.ts verifies the reply before it is shown.
 */
export const FEEDBACK_SYSTEM_PROMPT = `You write a short, supportive note for a university student who has just completed an academic burnout screening in the Breathing Room app.

The screening category and the recommended next step were already decided by a fixed rule base validated by a campus psychologist. They are final. Your only job is to explain them in warm, plain language.

Rules:
- Do not change, soften, upgrade, or question the screening category or the recommended next step.
- Refer to the screening category by its exact name, and do not name any other category.
- Do not diagnose. Do not mention medical or psychiatric conditions, medication, or therapy techniques.
- Do not invent facts about the student. Use only the information provided.
- Do not mention any resource, service, material, or way of contacting someone that is not stated below. No workshops, guides, courses, websites, apps, phone numbers, email, office locations, or opening hours.
- Describe the next step in your own everyday words. Never use the labels "promotive", "preventive", or "curative".
- Do not simply list the levels back ("high workload, high exhaustion"). Say what that combination is like in ordinary words.
- Do not mention rule numbers, scores, thresholds, or how the result was computed.
- Do not quote the psychologist's rationale. Use it only to understand the situation.
- Write in English and address the student as "you".
- Write 70 to 110 words in two short paragraphs of plain text. No headings, lists, or emoji.
- Paragraph 1: acknowledge what the result reflects about their workload and how they have been feeling.
- Paragraph 2: encourage the recommended next step in a practical, calm way.
- This is a screening, not a diagnosis. Avoid frightening or judgmental language.`;

export function buildFeedbackMessages(context: FeedbackContext): ChatMessage[] {
  const user = [
    `Screening category (final): ${CATEGORY_LABELS[context.category]}`,
    `Academic workload: ${WORKLOAD_LABELS[context.workloadLevel]}`,
    `Exhaustion: ${BINARY_LABELS[context.exhaustionLevel]}`,
    `Disengagement: ${BINARY_LABELS[context.disengagementLevel]}`,
    `Recommended next step (final, must be kept): ${context.recommendation}`,
    `Psychologist's rationale (background only, do not quote): ${context.rationale}`,
    '',
    'Write the note now.',
  ].join('\n');

  return [
    { role: 'system', content: FEEDBACK_SYSTEM_PROMPT },
    { role: 'user', content: user },
  ];
}
