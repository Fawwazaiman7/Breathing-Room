import type { ChatMessage } from './feedback.prompt.js';

export const GROQ_CHAT_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Change with GROQ_MODEL in .env. Groq retires models regularly; to see the
 * chat models your key can use right now, call
 * GET https://api.groq.com/openai/v1/models with the same API key.
 */
export const DEFAULT_GROQ_MODEL = 'openai/gpt-oss-120b';

/**
 * Upper limit for one reply. Reasoning models spend part of this budget on
 * their hidden reasoning before writing the note, so it is far above the
 * note's own length (the note is kept short by the prompt and the checker).
 */
export const GROQ_MAX_COMPLETION_TOKENS = 1500;

export type ReasoningEffort = 'low' | 'medium' | 'high';

export interface GroqRequest {
  apiKey: string;
  model: string;
  messages: ChatMessage[];
  /**
   * Optional, and only for models that support it (e.g. openai/gpt-oss-*).
   * Left out of the request unless set.
   */
  reasoningEffort?: ReasoningEffort;
  timeoutMs?: number;
  /** Replaceable in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

/** One chat completion. Resolves with the generated text or throws. */
export async function requestGroqCompletion(
  request: GroqRequest,
): Promise<string> {
  const doFetch = request.fetchImpl ?? fetch;
  const body: Record<string, unknown> = {
    model: request.model,
    messages: request.messages,
    temperature: 0.4,
    max_completion_tokens: GROQ_MAX_COMPLETION_TOKENS,
  };
  if (request.reasoningEffort) {
    body.reasoning_effort = request.reasoningEffort;
  }

  const response = await doFetch(GROQ_CHAT_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${request.apiKey}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(request.timeoutMs ?? 30000),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new Error(
      `Groq request failed with status ${response.status}: ${detail.slice(0, 300)}`,
    );
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: { content?: unknown };
      finish_reason?: unknown;
    }>;
  };
  const choice = data.choices?.[0];
  // The answer is in message.content. Reasoning models may also return a
  // separate message.reasoning field, which is deliberately ignored.
  const content = choice?.message?.content;
  if (typeof content !== 'string' || content.trim() === '') {
    if (choice?.finish_reason === 'length') {
      throw new Error(
        'Groq ran out of tokens before writing the note. Raise GROQ_MAX_COMPLETION_TOKENS or set GROQ_REASONING_EFFORT=low.',
      );
    }
    throw new Error('Groq response did not contain any text.');
  }
  return content;
}
