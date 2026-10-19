import { createContext } from 'react';

export type Role = 'student' | 'advisor';

export interface Profile {
  id: string;
  role: Role;
  full_name: string;
  class_name: string | null;
  student_number: string | null;
}

export interface SignUpDetails {
  fullName: string;
  studentNumber: string;
  className: string;
  email: string;
  password: string;
}

export type SignUpResult =
  | { ok: true; needsEmailConfirmation: boolean }
  | { ok: false; message: string };

export type SignInFailure =
  /** Wrong email or password. */
  | { kind: 'credentials' }
  /** The account exists but belongs to the other portal. */
  | { kind: 'wrongPortal'; role: Role }
  /** The account's role could not be read. */
  | { kind: 'unknown' }
  /** Right password, but the email address has not been verified yet. */
  | { kind: 'unconfirmed' };

export interface AuthState {
  status: 'loading' | 'signedOut' | 'signedIn';
  profile: Profile | null;
  /** The email the user signs in with, or null when signed out. */
  email: string | null;
  /**
   * Signs in through one portal. An account with a different role is not
   * signed in: the session is closed again and the result says which role
   * the account has, so the page can point to the right sign-in.
   * Returns null when sign-in succeeded.
   */
  signIn: (
    email: string,
    password: string,
    portal: Role,
  ) => Promise<SignInFailure | null>;
  /**
   * Creates a STUDENT account; the email address is then confirmed with a
   * code. Advisor accounts are created by the administrator.
   */
  signUp: (details: SignUpDetails) => Promise<SignUpResult>;
  /**
   * Checks the code emailed after sign-up. On success the account is
   * verified and signed in. Returns an error message, or null.
   */
  verifyEmailCode: (email: string, code: string) => Promise<string | null>;
  /** Emails a new sign-up code. Returns an error message, or null. */
  resendEmailCode: (email: string) => Promise<string | null>;
  /** Emails a code for setting a new password. Null when sent. */
  requestPasswordReset: (email: string) => Promise<string | null>;
  /**
   * Checks the emailed code and saves the new password. On success the
   * account is signed in. Returns an error message, or null.
   */
  resetPassword: (
    email: string,
    code: string,
    newPassword: string,
  ) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Reads the profile again, after the profile page has saved a change. */
  refreshProfile: () => Promise<void>;
  /**
   * Checks the current password, then sets the new one.
   * Returns an error message, or null when the password was changed.
   */
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<string | null>;
}

export const AuthContext = createContext<AuthState | null>(null);
