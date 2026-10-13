/**
 * Text embeddings from the Gemini API.
 *
 * Groq, which writes the chat replies, has no embedding models, so the
 * vectors used for intent recognition and retrieval come from here.
 * Only the text being embedded is sent: no name, student number or result.
 */

export const GEMINI_API_BASE =
  'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Change with GEMINI_EMBEDDING_MODEL in .env. Everything stored in the
 * database must be re-indexed (node kb/index-kb.mjs) after changing it,
 * because vectors from different models cannot be compared.
 */
export const DEFAULT_GEMINI_EMBEDDING_MODEL = 'gemini-embedding-2';

/** Must match the vector(768) columns in 004_support_chat.sql. */
export const EMBEDDING_DIMENSIONS = 768;

export type EmbeddingKind = 'query' | 'document';

/**
 * gemini-embedding-2 is told what a text is for through a prefix in the
 * text itself. Questions and passages get different prefixes so that a
 * question lands near the passages that answer it.
 */
export function formatForEmbedding(
  kind: EmbeddingKind,
  text: string,
  title?: string,
): string {
  const clean = text.trim().replace(/\s+/g, ' ');
  return kind === 'query'
    ? `task: search result | query: ${clean}`
    : `title: ${title?.trim() || 'none'} | text: ${clean}`;
}

export interface GeminiEmbeddingRequest {
  apiKey: string;
  model: string;
  text: string;
  kind: EmbeddingKind;
  /** Documents only: a short title, here the passage's topic. */
  title?: string;
  timeoutMs?: number;
  /** Replaceable in tests. Defaults to the global fetch. */
  fetchImpl?: typeof fetch;
}

export class GeminiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'GeminiError';
    this.status = status;
  }
}

/** One embedding. Resolves with 768 numbers or throws. */
export async function requestGeminiEmbedding(
  request: GeminiEmbeddingRequest,
): Promise<number[]> {
  const doFetch = request.fetchImpl ?? fetch;
  const response = await doFetch(
    `${GEMINI_API_BASE}/${encodeURIComponent(request.model)}:embedContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': request.apiKey,
      },
      body: JSON.stringify({
        model: `models/${request.model}`,
        content: {
          parts: [
            {
              text: formatForEmbedding(
                request.kind,
                request.text,
                request.title,
              ),
            },
          ],
        },
        output_dimensionality: EMBEDDING_DIMENSIONS,
      }),
      signal: AbortSignal.timeout(request.timeoutMs ?? 20000),
    },
  );

  if (!response.ok) {
    const detail = await response.text().catch(() => '');
    throw new GeminiError(
      response.status,
      `Gemini embedding request failed with status ${response.status}: ${detail.slice(0, 300)}`,
    );
  }

  // The REST reference returns { embedding: { values } }; the batch form
  // and the SDKs use { embeddings: [{ values }] }. Both are accepted.
  const data = (await response.json()) as {
    embedding?: { values?: unknown };
    embeddings?: Array<{ values?: unknown }>;
  };
  const values = data.embedding?.values ?? data.embeddings?.[0]?.values;
  if (
    !Array.isArray(values) ||
    values.some((value) => typeof value !== 'number' || !Number.isFinite(value))
  ) {
    throw new GeminiError(
      502,
      'Gemini response did not contain an embedding.',
    );
  }
  if (values.length !== EMBEDDING_DIMENSIONS) {
    throw new GeminiError(
      502,
      `Gemini returned ${values.length} dimensions, expected ${EMBEDDING_DIMENSIONS}. Check GEMINI_EMBEDDING_MODEL.`,
    );
  }
  return values as number[];
}
