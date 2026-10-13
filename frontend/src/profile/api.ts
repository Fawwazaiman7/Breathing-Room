import { request } from '../lib/api';

export interface ProfileUpdate {
  fullName: string;
  /** Students only. */
  studentNumber?: string;
  /** Students only. */
  className?: string;
}

export interface SavedProfile {
  id: string;
  role: 'student' | 'advisor';
  fullName: string;
  studentNumber: string | null;
  className: string | null;
}

/**
 * Saves the signed-in user's own details. The backend decides which fields
 * may change; the role and the advisor link can never be changed from here.
 */
export function updateProfile(update: ProfileUpdate): Promise<SavedProfile> {
  return request<SavedProfile>('/profile', {
    method: 'PATCH',
    body: JSON.stringify(update),
  });
}
