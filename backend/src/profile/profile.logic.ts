/**
 * Rules for a user editing their own profile, independent of NestJS and
 * Supabase so they can be unit-tested with an in-memory store.
 *
 * A user may change their name, and a student may also change their student
 * number (NIM) and class. Nothing else: the role, the advisor link and the
 * invite code are never taken from the request.
 */

export type ProfileRole = 'student' | 'advisor';

export interface ProfileUser {
  id: string;
  role: ProfileRole;
}

export interface ProfileRow {
  id: string;
  role: ProfileRole;
  full_name: string;
  student_number: string | null;
  class_name: string | null;
}

/** The only columns a user may change about themselves. */
export interface ProfilePatch {
  full_name: string;
  student_number?: string;
  class_name?: string;
}

/** What the logic needs from the database. */
export interface ProfileStore {
  /**
   * Applies the patch to the user's own row. Returns the saved row,
   * 'student_number_taken' when another account has that student number,
   * or null when the user has no profile.
   */
  updateProfile(
    user: ProfileUser,
    patch: ProfilePatch,
  ): Promise<ProfileRow | 'student_number_taken' | null>;
}

/** The request body, before it has been checked. */
export interface ProfileInput {
  fullName?: unknown;
  studentNumber?: unknown;
  className?: unknown;
}

export interface ProfileView {
  id: string;
  role: ProfileRole;
  fullName: string;
  studentNumber: string | null;
  className: string | null;
}

export type ProfileErrorKind = 'INVALID' | 'STUDENT_NUMBER_TAKEN' | 'NOT_FOUND';

export class ProfileError extends Error {
  kind: ProfileErrorKind;

  constructor(kind: ProfileErrorKind, message: string) {
    super(message);
    this.name = 'ProfileError';
    this.kind = kind;
  }
}

export const FULL_NAME_MAX = 120;
export const CLASS_NAME_MAX = 30;
/** Same rule as the sign-up page: digits only, 5 to 20 of them. */
export const STUDENT_NUMBER_PATTERN = /^[0-9]{5,20}$/;

/** Trims the text and turns runs of spaces into a single space. */
function tidy(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

/**
 * Checks the input and returns exactly the columns that will be written.
 * Only the keys listed in ProfilePatch can ever appear in the result.
 */
export function buildProfilePatch(
  role: ProfileRole,
  input: ProfileInput,
): ProfilePatch {
  const fullName = tidy(input.fullName);
  if (fullName.length === 0) {
    throw new ProfileError('INVALID', 'Enter your full name.');
  }
  if (fullName.length > FULL_NAME_MAX) {
    throw new ProfileError(
      'INVALID',
      `Your name can be at most ${FULL_NAME_MAX} characters.`,
    );
  }
  if (role !== 'student') {
    // Advisors have no student number or class; anything sent is ignored.
    return { full_name: fullName };
  }

  const studentNumber =
    typeof input.studentNumber === 'string' ? input.studentNumber.trim() : '';
  if (!STUDENT_NUMBER_PATTERN.test(studentNumber)) {
    throw new ProfileError(
      'INVALID',
      'Enter your student number (NIM) using 5 to 20 digits.',
    );
  }
  const className = tidy(input.className);
  if (className.length === 0) {
    throw new ProfileError('INVALID', 'Enter your class, for example TI 6A.');
  }
  if (className.length > CLASS_NAME_MAX) {
    throw new ProfileError(
      'INVALID',
      `Your class can be at most ${CLASS_NAME_MAX} characters.`,
    );
  }
  return {
    full_name: fullName,
    student_number: studentNumber,
    class_name: className,
  };
}

export function toProfileView(row: ProfileRow): ProfileView {
  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    studentNumber: row.student_number,
    className: row.class_name,
  };
}

/** Saves the signed-in user's own details and returns the saved profile. */
export async function updateMyProfile(
  store: ProfileStore,
  user: ProfileUser,
  input: ProfileInput,
): Promise<ProfileView> {
  const patch = buildProfilePatch(user.role, input);
  const saved = await store.updateProfile(user, patch);
  if (saved === 'student_number_taken') {
    throw new ProfileError(
      'STUDENT_NUMBER_TAKEN',
      'This student number is already used by another account.',
    );
  }
  if (!saved) {
    throw new ProfileError('NOT_FOUND', 'No profile found for this account.');
  }
  return toProfileView(saved);
}
