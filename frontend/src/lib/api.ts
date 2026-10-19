import type {
  ScreeningHistoryItem,
  ScreeningPayload,
  SubmittedScreening,
} from '../screening/types';
import { supabase } from './supabase';

const API_URL = import.meta.env.VITE_API_URL;

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

/** Calls the NestJS backend with the signed-in user's access token. */
export async function request<T>(
  path: string,
  init?: RequestInit,
): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) {
    throw new ApiError(401, 'Your session has ended. Please sign in again.');
  }

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
    });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Please try again.');
  }

  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const body: unknown = await response.json();
      const detail = (body as { message?: unknown }).message;
      if (typeof detail === 'string') {
        message = detail;
      } else if (Array.isArray(detail)) {
        message = detail.join(' ');
      }
    } catch {
      // Keep the default message when the body is not JSON.
    }
    throw new ApiError(response.status, message);
  }

  return (await response.json()) as T;
}

export function submitScreening(
  payload: ScreeningPayload,
): Promise<SubmittedScreening> {
  return request<SubmittedScreening>('/screening', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchMyScreenings(): Promise<ScreeningHistoryItem[]> {
  return request<ScreeningHistoryItem[]>('/screening/mine');
}

export interface ScreeningFeedback {
  /** The "A note for you" text, or null when none is available. */
  feedbackText: string | null;
}

const feedbackRequests = new Map<string, Promise<ScreeningFeedback>>();

/**
 * Asks the backend for the note that explains one screening result. The
 * backend writes it once and then serves it from the database. Requests for
 * the same screening share one call, so the note is never generated twice
 * from this page.
 */
export function requestFeedback(
  screeningId: string,
  language: 'en' | 'id' = 'en',
): Promise<ScreeningFeedback> {
  // Each language has its own note, so each has its own request.
  const key = `${screeningId}:${language}`;
  let pending = feedbackRequests.get(key);
  if (!pending) {
    pending = request<ScreeningFeedback>(`/screening/${screeningId}/feedback`, {
      method: 'POST',
      body: JSON.stringify({ language }),
    }).finally(() => {
      feedbackRequests.delete(key);
    });
    feedbackRequests.set(key, pending);
  }
  return pending;
}
