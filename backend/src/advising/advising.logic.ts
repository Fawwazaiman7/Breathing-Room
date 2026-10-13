import { generateInviteCode, normalizeInviteCode } from './advising.code.js';

/**
 * Rules for linking students and Academic Advisors, independent of NestJS
 * and Supabase so they can be unit-tested with an in-memory store.
 *
 * The model: an advisor owns one invite code. A student who enters it is
 * linked to that advisor. The student performs the linking, so their
 * screening results are never exposed to an advisor without their action.
 */

export type AdvisingRole = 'student' | 'advisor';

export interface AdvisingUser {
  id: string;
  role: AdvisingRole;
}

export interface AdvisingProfile {
  id: string;
  role: AdvisingRole;
  full_name: string;
  advisor_id: string | null;
  invite_code: string | null;
}

/** What the logic needs from the database. */
export interface AdvisingStore {
  getProfile(id: string): Promise<AdvisingProfile | null>;
  findAdvisorByCode(code: string): Promise<AdvisingProfile | null>;
  setAdvisor(studentId: string, advisorId: string): Promise<void>;
  /** 'taken' when another advisor already has this code. */
  setInviteCode(advisorId: string, code: string): Promise<'ok' | 'taken'>;
  /** Unlinks the student only if they belong to this advisor. */
  unlinkStudent(advisorId: string, studentId: string): Promise<boolean>;
}

export type AdvisingErrorKind =
  | 'FORBIDDEN_ROLE'
  | 'INVALID_CODE'
  | 'CODE_NOT_FOUND'
  | 'NOT_FOUND'
  | 'CODE_UNAVAILABLE';

export class AdvisingError extends Error {
  kind: AdvisingErrorKind;

  constructor(kind: AdvisingErrorKind, message: string) {
    super(message);
    this.name = 'AdvisingError';
    this.kind = kind;
  }
}

export interface AdvisorSummary {
  id: string;
  fullName: string;
}

const MAX_CODE_ATTEMPTS = 5;

function requireRole(user: AdvisingUser, role: AdvisingRole): void {
  if (user.role !== role) {
    throw new AdvisingError(
      'FORBIDDEN_ROLE',
      role === 'student'
        ? 'Only students can do this.'
        : 'Only Academic Advisors can do this.',
    );
  }
}

async function advisorForCode(
  store: AdvisingStore,
  rawCode: unknown,
): Promise<AdvisingProfile> {
  const code = normalizeInviteCode(rawCode);
  if (!code) {
    throw new AdvisingError(
      'INVALID_CODE',
      'That does not look like an advisor code. Codes have 8 characters, like AB2C-9KMP.',
    );
  }
  const advisor = await store.findAdvisorByCode(code);
  if (!advisor || advisor.role !== 'advisor') {
    throw new AdvisingError(
      'CODE_NOT_FOUND',
      'No Academic Advisor was found for this code. Check it with your advisor.',
    );
  }
  return advisor;
}

function summarize(profile: AdvisingProfile): AdvisorSummary {
  return { id: profile.id, fullName: profile.full_name };
}

/* ---------------------------- Student side ---------------------------- */

/** The advisor the student is linked to, or null. */
export async function getMyAdvisor(
  store: AdvisingStore,
  user: AdvisingUser,
): Promise<AdvisorSummary | null> {
  requireRole(user, 'student');
  const me = await store.getProfile(user.id);
  if (!me?.advisor_id) {
    return null;
  }
  const advisor = await store.getProfile(me.advisor_id);
  return advisor && advisor.role === 'advisor' ? summarize(advisor) : null;
}

/** Whose code is this? Lets the student confirm the name before linking. */
export async function previewAdvisor(
  store: AdvisingStore,
  user: AdvisingUser,
  rawCode: unknown,
): Promise<AdvisorSummary> {
  requireRole(user, 'student');
  return summarize(await advisorForCode(store, rawCode));
}

/** Links the student to the advisor who owns the code. */
export async function joinAdvisor(
  store: AdvisingStore,
  user: AdvisingUser,
  rawCode: unknown,
): Promise<AdvisorSummary> {
  requireRole(user, 'student');
  const advisor = await advisorForCode(store, rawCode);
  await store.setAdvisor(user.id, advisor.id);
  return summarize(advisor);
}

/* ---------------------------- Advisor side ---------------------------- */

async function assignNewCode(
  store: AdvisingStore,
  advisorId: string,
  randomInt: (max: number) => number,
): Promise<string> {
  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    const code = generateInviteCode(randomInt);
    if ((await store.setInviteCode(advisorId, code)) === 'ok') {
      return code;
    }
  }
  throw new AdvisingError(
    'CODE_UNAVAILABLE',
    'Could not create a code. Please try again.',
  );
}

/** The advisor's current code, created on first use. */
export async function getInviteCode(
  store: AdvisingStore,
  user: AdvisingUser,
  randomInt: (max: number) => number,
): Promise<string> {
  requireRole(user, 'advisor');
  const me = await store.getProfile(user.id);
  return me?.invite_code ?? assignNewCode(store, user.id, randomInt);
}

/**
 * Replaces the advisor's code. The old code stops working at once;
 * students who are already linked stay linked.
 */
export async function regenerateInviteCode(
  store: AdvisingStore,
  user: AdvisingUser,
  randomInt: (max: number) => number,
): Promise<string> {
  requireRole(user, 'advisor');
  return assignNewCode(store, user.id, randomInt);
}

/** Removes a student from this advisor's list. */
export async function removeStudent(
  store: AdvisingStore,
  user: AdvisingUser,
  studentId: string,
): Promise<void> {
  requireRole(user, 'advisor');
  if (!(await store.unlinkStudent(user.id, studentId))) {
    throw new AdvisingError('NOT_FOUND', 'Student not found.');
  }
}
