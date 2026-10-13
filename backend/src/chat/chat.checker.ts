import type { ScreeningCategory } from '../screening/screening.types.js';
import type { PassageMatch } from './chat.types.js';

export type ChatCheck =
  | { ok: true; text: string }
  | { ok: false; reason: string };

export const MAX_REPLY_WORDS = 200;

/** Staff-facing intervention labels that should not reach a student. */
const INTERVENTION_LABELS = /\b(promotive|preventive|curative|promotif|preventif|kuratif)\b/i;

const RULE_ID = /\bR(?:[1-9]|1\d|20)\b/;
const PASSAGE_ID = /\s*\[?\b(?:BI|WL|ED|TM|SR|SS)-\d{2}\b\]?/g;

/** Telling the student they have a condition, or advising on medication. */
const DIAGNOSIS =
  /\b(you|kamu|anda)\b[^.!?\n]{0,40}\b(have|has|suffer\w*|are suffering|mengalami|menderita|mengidap)\b[^.!?\n]{0,30}\b(depression|depresi|anxiety disorder|gangguan \w+|disorder|bipolar|ptsd|adhd)\b/i;
const MEDICATION = /\b(antidepress\w*|medication|sedative\w*|obat penenang|obat tidur|antidepresan)\b/i;

const URL = /\bhttps?:\/\/[^\s)>\]]+|\b[\w-]+(?:\.[\w-]+)*\.(?:ac\.id|co\.id|go\.id|com|org|net|id|co)\b(?:\/[^\s)>\]]*)?/gi;
/** A run of at least eight digits, allowing spaces, dashes, dots and "+". */
const PHONE = /\+?\d[\d\s().-]{6,}\d/g;

/** Phrases that state what the student's own category is. */
const CATEGORY_NAMES: Array<[ScreeningCategory, RegExp]> = [
  ['NO_BURNOUT', /\b(no burn-?out|tidak (mengalami )?burn-?out|tanpa burn-?out)\b/i],
  ['LOW_RISK', /\b(low[- ]risk|risiko rendah)\b/i],
  ['MODERATE_RISK', /\b(moderate[- ]risk|risiko sedang)\b/i],
  ['HIGH_RISK', /\b(high[- ]risk|risiko tinggi)\b/i],
];
const ABOUT_THE_STUDENT =
  /\b(your (latest |screening |current )*(result|category)|you (are|were) (at|in)|hasil( skrining)?(mu| kamu| anda)|kategori(mu| kamu| anda)|kamu (berada|termasuk)|anda (berada|termasuk))\b/i;

function tidy(raw: string): string {
  return raw
    .trim()
    .replace(/\r\n/g, '\n')
    // The prompt asks for plain text; stray markdown is removed, not shown.
    .replace(/\*\*|__/g, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(PASSAGE_ID, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const digitsOf = (text: string): string => text.replace(/\D/g, '');

/** Sentences are checked one at a time for claims about the student's category. */
function claimedCategories(text: string): ScreeningCategory[] {
  const found: ScreeningCategory[] = [];
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    if (!ABOUT_THE_STUDENT.test(sentence)) {
      continue;
    }
    for (const [category, pattern] of CATEGORY_NAMES) {
      if (pattern.test(sentence)) {
        found.push(category);
      }
    }
  }
  return found;
}

export interface ChatCheckContext {
  passages: readonly PassageMatch[];
  /**
   * The student's stored category when it was given to the model;
   * null or undefined when the model was not given a result.
   */
  category?: ScreeningCategory | null;
}

/**
 * Decides whether an LLM reply may be shown to the student.
 *
 * A guard, not a proof. It catches the failures that matter most here:
 * stating a screening category the rule base did not decide, inventing a
 * contact detail, and drifting into diagnosis. A rejected reply is never
 * shown; the student gets a passage from the knowledge base instead.
 */
export function checkChatReply(raw: string, context: ChatCheckContext): ChatCheck {
  const text = tidy(typeof raw === 'string' ? raw : '');
  if (!text) {
    return { ok: false, reason: 'empty reply' };
  }
  const words = text.split(/\s+/).length;
  if (words > MAX_REPLY_WORDS) {
    return { ok: false, reason: `too long (${words} words)` };
  }
  if (INTERVENTION_LABELS.test(text)) {
    return { ok: false, reason: 'uses a staff intervention label' };
  }
  if (RULE_ID.test(text)) {
    return { ok: false, reason: 'mentions a rule id' };
  }
  if (DIAGNOSIS.test(text)) {
    return { ok: false, reason: 'states a diagnosis' };
  }
  if (MEDICATION.test(text)) {
    return { ok: false, reason: 'mentions medication' };
  }

  // Contact details must come from the passages, character for character.
  const knowledge = context.passages.map((p) => p.content).join('\n');
  const knowledgeLower = knowledge.toLowerCase();
  for (const url of text.match(URL) ?? []) {
    const bare = url.toLowerCase().replace(/[.,;:!?]+$/, '');
    if (!knowledgeLower.includes(bare)) {
      return { ok: false, reason: `link not in the knowledge base: ${bare}` };
    }
  }
  const knowledgeDigits = digitsOf(knowledge);
  for (const phone of text.match(PHONE) ?? []) {
    const digits = digitsOf(phone);
    if (digits.length >= 8 && !knowledgeDigits.includes(digits)) {
      return { ok: false, reason: 'phone number not in the knowledge base' };
    }
  }

  // The category belongs to the rule base. The reply may repeat the stored
  // one and nothing else.
  for (const claimed of claimedCategories(text)) {
    if (!context.category) {
      return { ok: false, reason: 'states a category without a stored result' };
    }
    if (claimed !== context.category) {
      return { ok: false, reason: `states a different category (${claimed})` };
    }
  }

  return { ok: true, text };
}
