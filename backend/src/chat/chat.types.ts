/**
 * The six things a student can ask the Support Chat about. Each knowledge
 * base passage belongs to one of them, and each of the labelled example
 * questions is tagged with one.
 */
export const CHAT_INTENTS = [
  'BURNOUT_INFO',
  'WORKLOAD',
  'EXHAUSTION_DISENGAGEMENT',
  'TIME_MANAGEMENT',
  'SCREENING_RESULT',
  'STUDENT_SUPPORT',
] as const;

export type ChatIntent = (typeof CHAT_INTENTS)[number];

export const INTENT_LABELS: Record<ChatIntent, string> = {
  BURNOUT_INFO: 'Burnout info',
  WORKLOAD: 'Workload issues',
  EXHAUSTION_DISENGAGEMENT: 'Exhaustion and disengagement',
  TIME_MANAGEMENT: 'Time management',
  SCREENING_RESULT: 'Screening result',
  STUDENT_SUPPORT: 'Student support',
};

export function isChatIntent(value: unknown): value is ChatIntent {
  return (CHAT_INTENTS as readonly unknown[]).includes(value);
}

/** One labelled example question with its embedding. */
export interface IntentExample {
  id: string;
  intent: ChatIntent;
  embedding: number[];
}

/** A knowledge base passage returned by the similarity search. */
export interface PassageMatch {
  id: string;
  topic: ChatIntent;
  content: string;
  /** Cosine similarity to the question: 1 = same meaning, 0 = unrelated. */
  similarity: number;
}

/** One earlier turn of the conversation, as sent by the browser. */
export interface ChatTurn {
  role: 'user' | 'assistant';
  text: string;
}
