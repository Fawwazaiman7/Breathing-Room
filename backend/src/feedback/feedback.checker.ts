import type { ScreeningCategory } from '../screening/screening.types.js';
import type { FeedbackContext } from './feedback.context.js';

export type FeedbackCheck =
  | { ok: true; text: string }
  | { ok: false; reason: string };

/** How each category might be named in the note. */
const CATEGORY_MENTIONS: Record<ScreeningCategory, RegExp> = {
  NO_BURNOUT: /\bno (signs? of )?burn-?out\b/i,
  LOW_RISK: /\blow[- ]risk\b/i,
  MODERATE_RISK: /\bmoderate[- ]risk\b/i,
  HIGH_RISK: /\bhigh[- ]risk\b/i,
};

/** Clinical territory the note must stay out of. */
const CLINICAL_TERMS =
  /\b(depress\w*|disorder\w*|medicat\w*|antidepress\w*|psychiatr\w*|suicid\w*|self-harm\w*)\b/i;

/** Staff-facing intervention labels that should not reach a student. */
const INTERVENTION_LABELS = /\b(promotive|preventive|curative)\b/i;

/**
 * Resources and contact channels the system never gave the model, so any
 * mention of them is invented (e.g. "workshops", "contact them by phone").
 */
const INVENTED_DETAILS =
  /\b(phone|telephone|hotline|e-?mail|website|workshops?|webinars?|seminars?|brochures?|opening hours)\b/i;

const RULE_ID = /\bR(?:[1-9]|1\d|20)\b/;
const SELF_REFERENCE = /\b(as an ai|language model|i am an ai|i'm an ai)\b/i;

/** The validated action has to survive in the note. */
const REQUIRED_ACTION: Partial<
  Record<FeedbackContext['interventionLevel'], RegExp>
> = {
  PREVENTIVE: /\b(advisor|DPA)\b/i,
  CURATIVE: /\b(counsel\w*|BK PNJ)\b/i,
};

const MIN_WORDS = 40;
const MAX_WORDS = 160;

function tidy(raw: string): string {
  return raw
    .trim()
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/**
 * Decides whether an LLM reply may be shown to the student.
 *
 * This is a guard, not a proof: it catches the failures that matter most
 * (naming a different category, dropping the recommended action, drifting
 * into clinical language). A rejected note is simply not shown; the
 * rule-based result is displayed either way.
 */
export function checkFeedback(
  raw: string,
  context: FeedbackContext,
): FeedbackCheck {
  const text = tidy(typeof raw === 'string' ? raw : '');
  if (!text) {
    return { ok: false, reason: 'empty reply' };
  }

  const words = text.split(/\s+/).length;
  if (words < MIN_WORDS || words > MAX_WORDS) {
    return { ok: false, reason: `length out of range (${words} words)` };
  }

  for (const category of Object.keys(CATEGORY_MENTIONS) as ScreeningCategory[]) {
    if (category !== context.category && CATEGORY_MENTIONS[category].test(text)) {
      return { ok: false, reason: `mentions another category (${category})` };
    }
  }

  const clinical = CLINICAL_TERMS.exec(text);
  if (clinical) {
    return { ok: false, reason: `clinical term "${clinical[0]}"` };
  }
  const label = INTERVENTION_LABELS.exec(text);
  if (label) {
    return { ok: false, reason: `uses the staff label "${label[0]}"` };
  }
  const invented = INVENTED_DETAILS.exec(text);
  if (invented) {
    return { ok: false, reason: `mentions "${invented[0]}", which was not provided` };
  }
  if (RULE_ID.test(text)) {
    return { ok: false, reason: 'mentions a rule number' };
  }
  if (SELF_REFERENCE.test(text)) {
    return { ok: false, reason: 'refers to itself as an AI' };
  }

  const required = REQUIRED_ACTION[context.interventionLevel];
  if (required && !required.test(text)) {
    return { ok: false, reason: 'recommended action is missing' };
  }

  return { ok: true, text };
}
