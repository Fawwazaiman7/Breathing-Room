import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { supabase } from '../lib/supabase';
import { AuthContext } from './auth-context';
import type {
  AuthState,
  Profile,
  Role,
  SignInFailure,
  SignUpDetails,
  SignUpResult,
} from './auth-context';

const PROFILE_COLUMNS = 'id, role, full_name, class_name, student_number';

interface LoadedProfile {
  userId: string;
  profile: Profile | null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  // undefined = still checking for a saved session; null = signed out.
  const [userId, setUserId] = useState<string | null | undefined>(undefined);
  const [email, setEmail] = useState<string | null>(null);
  const [loaded, setLoaded] = useState<LoadedProfile | null>(null);
  // True while a sign-in is being checked against the portal it came from.
  // Until that check is done the app does not treat the user as signed in.
  const [checkingPortal, setCheckingPortal] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (active) {
        setUserId(data.session?.user.id ?? null);
        setEmail(data.session?.user.email ?? null);
      }
    });
    // Keep this callback free of other Supabase calls; the profile is
    // loaded by the effect below once the user id changes.
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUserId(session?.user.id ?? null);
        setEmail(session?.user.email ?? null);
      },
    );
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      return;
    }
    let active = true;
    void supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (active) {
          setLoaded({ userId, profile: (data as Profile | null) ?? null });
        }
      });
    return () => {
      active = false;
    };
  }, [userId]);

  const refreshProfile = useCallback(async () => {
    if (!userId) {
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select(PROFILE_COLUMNS)
      .eq('id', userId)
      .single();
    // Keep the profile we already have if this read fails.
    if (data) {
      setLoaded({ userId, profile: data as Profile });
    }
  }, [userId]);

  const signIn = useCallback(
    async (
      email: string,
      password: string,
      portal: Role,
    ): Promise<SignInFailure | null> => {
      setCheckingPortal(true);
      try {
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error || !data.user) {
          return { kind: 'credentials' };
        }
        // Each portal only accepts accounts with its own role.
        const { data: row } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .single();
        const role = (row as { role?: Role } | null)?.role;
        if (role === portal) {
          return null;
        }
        await supabase.auth.signOut();
        return role === 'student' || role === 'advisor'
          ? { kind: 'wrongPortal', role }
          : { kind: 'unknown' };
      } finally {
        setCheckingPortal(false);
      }
    },
    [],
  );

  const signUp = useCallback(
    async (details: SignUpDetails): Promise<SignUpResult> => {
      const { data, error } = await supabase.auth.signUp({
        email: details.email,
        password: details.password,
        // Saved to the profile by the database when the account is created.
        // The role is not sent: new accounts are always students.
        options: {
          data: {
            full_name: details.fullName,
            student_number: details.studentNumber,
            class_name: details.className,
          },
        },
      });
      if (error) {
        const text = error.message ?? '';
        if (/database error/i.test(text)) {
          return {
            ok: false,
            message:
              'We could not create the account. This student number may already be registered.',
          };
        }
        if (/already registered|already exists/i.test(text)) {
          return {
            ok: false,
            message:
              'An account with this email already exists. Try signing in instead.',
          };
        }
        if (/password/i.test(text)) {
          return { ok: false, message: text };
        }
        return {
          ok: false,
          message: 'We could not create the account. Please try again.',
        };
      }
      // No session means Supabase is waiting for the email to be confirmed.
      return { ok: true, needsEmailConfirmation: !data.session };
    },
    [],
  );

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      if (!email) {
        return 'Your session has ended. Please sign in again.';
      }
      // Signing in again proves the person at the keyboard knows the current
      // password before it is replaced.
      const check = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (check.error) {
        return /invalid login credentials/i.test(check.error.message ?? '')
          ? 'Your current password is not correct.'
          : 'We could not check your current password. Please try again.';
      }
      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (error) {
        const text = error.message ?? '';
        // Supabase explains password rules in plain words, e.g. too short or
        // the same as the old one.
        return /password/i.test(text)
          ? text
          : 'We could not change your password. Please try again.';
      }
      return null;
    },
    [email],
  );

  const value = useMemo<AuthState>(() => {
    const profileReady = Boolean(userId) && loaded?.userId === userId;
    let status: AuthState['status'];
    if (checkingPortal || userId === undefined || (userId && !profileReady)) {
      status = 'loading';
    } else if (userId === null) {
      status = 'signedOut';
    } else {
      status = 'signedIn';
    }
    return {
      status,
      profile: profileReady ? (loaded?.profile ?? null) : null,
      email: userId ? email : null,
      signIn,
      signUp,
      signOut,
      refreshProfile,
      changePassword,
    };
  }, [
    userId,
    email,
    loaded,
    checkingPortal,
    signIn,
    signUp,
    signOut,
    refreshProfile,
    changePassword,
  ]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
