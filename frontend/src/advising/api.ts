import { request } from '../lib/api';

export interface MyAdvisor {
  id: string;
  fullName: string;
}

/* ------------------------------- Students ------------------------------- */

export function fetchMyAdvisor(): Promise<{ advisor: MyAdvisor | null }> {
  return request<{ advisor: MyAdvisor | null }>('/advising/advisor');
}

/** Whose code is this? Nothing is linked yet. */
export function previewAdvisor(
  code: string,
): Promise<{ advisor: { fullName: string } }> {
  return request<{ advisor: { fullName: string } }>('/advising/preview', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

export function joinAdvisor(code: string): Promise<{ advisor: MyAdvisor }> {
  return request<{ advisor: MyAdvisor }>('/advising/join', {
    method: 'POST',
    body: JSON.stringify({ code }),
  });
}

/* ------------------------------- Advisors ------------------------------- */

export function fetchInviteCode(): Promise<{ code: string }> {
  return request<{ code: string }>('/advising/code');
}

export function regenerateInviteCode(): Promise<{ code: string }> {
  return request<{ code: string }>('/advising/code/regenerate', {
    method: 'POST',
  });
}

export function removeStudent(studentId: string): Promise<{ removed: true }> {
  return request<{ removed: true }>(`/advising/students/${studentId}`, {
    method: 'DELETE',
  });
}
