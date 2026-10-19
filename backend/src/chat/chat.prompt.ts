import {
  BINARY_LABELS,
  CATEGORY_LABELS,
  WORKLOAD_LABELS,
} from '../feedback/feedback.prompt.js';
import type { ChatMessage } from '../feedback/feedback.prompt.js';
import type { InterventionLevel } from '../screening/rule-engine/rule-base.js';
import type {
  BinaryLevel,
  ScreeningCategory,
  WorkloadLevel,
} from '../screening/screening.types.js';
import { INTENT_LABELS } from './chat.types.js';
import type { ChatIntent, ChatTurn, PassageMatch } from './chat.types.js';

/**
 * The student's latest screening, as decided by the rule base. Only the
 * categorical outcome is given to the model: no scores, answers or names.
 */
export interface ChatResultContext {
  category: ScreeningCategory;
  workloadLevel: WorkloadLevel;
  exhaustionLevel: BinaryLevel;
  disengagementLevel: BinaryLevel;
  interventionLevel: InterventionLevel;
}

/** The validated next step in plain words, without the staff labels. */
export const NEXT_STEP_IN_PLAIN_WORDS: Record<InterventionLevel, string> = {
  PROMOTIVE: 'self-help education',
  PREVENTIVE: 'a consultation with their Academic Advisor',
  CURATIVE: 'a counselling referral',
};

export const MAX_HISTORY_TURNS = 6;
export const MAX_TURN_CHARACTERS = 600;

export const CHAT_SYSTEM_PROMPT = [
  'You are the Support Chat of Ruang Pulih, a study wellbeing app for university students.',
  'You give general information about academic burnout, academic workload, exhaustion and disengagement, time management, the screening result, and student support.',
  '',
  'Rules:',
  '1. Use only what is written in the KNOWLEDGE passages, and in RESULT when it is given. Do not add facts, techniques, statistics, names, phone numbers, links, places or opening hours that are not written there.',
  '2. If the passages do not answer the question, say so in one sentence and say what you can help with. For personal matters you may suggest talking to their Academic Advisor.',
  '3. Do not offer tips, techniques, exercises or topics that the passages do not contain. If you end with an offer, keep it general, for example that they can ask another question.',
  '4. Counselling and advising are provided by the student\'s campus; Ruang Pulih is only the app. Name only services that are written in the passages, exactly as written.',
  '5. You never decide, guess, change or dispute a screening category. The category is set only by the validated rules in the app. If RESULT is given you may explain it. If RESULT is not given, do not state what the student\'s result or category is, even if they tell you one.',
  '6. Do not diagnose. Do not name medical or psychiatric conditions as something the student has. Do not give advice about medication or treatment.',
  '7. Be warm, calm and plain. No judgement, no alarm. Do not use the words "promotive", "preventive" or "curative".',
  '8. Keep it short and easy to scan, at most 80 words. Start with one sentence of at most 25 words that answers the question. Then give 2 to 4 key points, each on its own line starting with "- ", each at most 15 words. Use "1. ", "2. " instead of "- " only when the points are steps in order. No headings, no bold, no asterisks.',
  '9. Reply in the language of the student\'s latest message: English or Indonesian. In Indonesian, address the student as "kamu".',
  '10. The codes in square brackets identify passages for you. Never mention them.',
].join('\n');

function clip(text: string): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return clean.length > MAX_TURN_CHARACTERS
    ? `${clean.slice(0, MAX_TURN_CHARACTERS)}…`
    : clean;
}

function describeResult(result: ChatResultContext | null): string {
  if (!result) {
    return 'RESULT: The student has not completed a screening yet.';
  }
  return [
    'RESULT (the student\'s latest screening, decided by the validated rules; explain it, never change it):',
    `Category: ${CATEGORY_LABELS[result.category]}`,
    `Academic workload: ${WORKLOAD_LABELS[result.workloadLevel]}`,
    `Exhaustion: ${BINARY_LABELS[result.exhaustionLevel]}`,
    `Disengagement: ${BINARY_LABELS[result.disengagementLevel]}`,
    `Validated next step: ${NEXT_STEP_IN_PLAIN_WORDS[result.interventionLevel]}`,
  ].join('\n');
}

export interface ChatPromptInput {
  message: string;
  history: readonly ChatTurn[];
  intent: ChatIntent | null;
  passages: readonly PassageMatch[];
  /**
   * undefined = the result was not looked up, so RESULT is left out.
   * null = looked up, and the student has no screening yet.
   */
  result?: ChatResultContext | null;
}

export function buildChatMessages(input: ChatPromptInput): ChatMessage[] {
  const knowledge =
    input.passages.length > 0
      ? input.passages
          .map((passage) => `[${passage.id}] ${passage.content}`)
          .join('\n')
      : '(no passage matched this question)';

  const parts = [
    `TOPIC: ${input.intent ? INTENT_LABELS[input.intent] : 'not recognised'}`,
    `KNOWLEDGE:\n${knowledge}`,
  ];
  if (input.result !== undefined) {
    parts.push(describeResult(input.result));
  }
  parts.push(`QUESTION: ${clip(input.message)}`);

  const history: ChatMessage[] = input.history
    .slice(-MAX_HISTORY_TURNS)
    .filter((turn) => turn.text.trim() !== '')
    .map((turn) => ({ role: turn.role, content: clip(turn.text) }));

  return [
    { role: 'system', content: CHAT_SYSTEM_PROMPT },
    ...history,
    { role: 'user', content: parts.join('\n\n') },
  ];
}
