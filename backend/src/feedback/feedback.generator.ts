import { checkFeedback } from './feedback.checker.js';
import type { FeedbackContext } from './feedback.context.js';
import { buildFeedbackMessages } from './feedback.prompt.js';
import type { ChatMessage } from './feedback.prompt.js';

export const MAX_FEEDBACK_ATTEMPTS = 2;

/**
 * Asks the LLM for a note and returns it only if it passes the checker.
 * Returns null when no acceptable note was produced. Errors from `complete`
 * (network, quota, timeout) are thrown to the caller.
 */
export async function generateFeedback(
  context: FeedbackContext,
  complete: (messages: ChatMessage[]) => Promise<string>,
  onRejected?: (reason: string, attempt: number) => void,
): Promise<string | null> {
  const messages = buildFeedbackMessages(context);
  for (let attempt = 1; attempt <= MAX_FEEDBACK_ATTEMPTS; attempt += 1) {
    const check = checkFeedback(await complete(messages), context);
    if (check.ok) {
      return check.text;
    }
    onRejected?.(check.reason, attempt);
  }
  return null;
}
