import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import '../advising/advising.css';
import type { Role, SignInFailure } from '../auth/auth-context';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { ArrowRightIcon } from '../components/Icons';
import { VerifyEmailCard } from '../components/VerifyEmailCard';
import { usePageTitle } from '../lib/usePageTitle';

/**
 * Wording for each portal. Every sign-in belongs to exactly one portal, and
 * a portal only accepts accounts with its own role.
 */
const PORTAL_COPY: Record<
  Role,
  {
    eyebrow: string;
    title: string;
    text: string;
    /** "a student", as in "signed in as a student". */
    accountName: string;
    /** Shown on the OTHER portal when an account of this role tries it. */
    wrongPortalTitle: string;
    wrongPortalText: string;
    wrongPortalLink: string;
  }
> = {
  student: {
    eyebrow: 'Student portal',
    title: 'Student sign in',
    text: 'Sign in to take a screening and see your results.',
    accountName: 'a student',
    wrongPortalTitle: 'This is a student account',
    wrongPortalText: 'Students sign in on their own page.',
    wrongPortalLink: 'Continue to student sign in',
  },
  advisor: {
    eyebrow: 'Advisor portal',
    title: 'Advisor sign in',
    text: 'Sign in to see the screening summaries of your students.',
    accountName: 'an Academic Advisor',
    wrongPortalTitle: 'This is an Academic Advisor account',
    wrongPortalText: 'Academic Advisors sign in on their own page.',
    wrongPortalLink: 'Continue to advisor sign in',
  },
};

const HOME: Record<Role, string> = { student: '/app', advisor: '/advisor' };

export function SignInPage() {
  usePageTitle('Sign in');
  const { status, profile, signIn, signOut, resendEmailCode } = useAuth();
  const [searchParams] = useSearchParams();
  // /sign-in?as=advisor is the advisor portal; everything else is the
  // student portal.
  const portal: Role =
    searchParams.get('as') === 'advisor' ? 'advisor' : 'student';
  const copy = PORTAL_COPY[portal];
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // A failure remembers its portal, so it disappears when the visitor
  // switches to the other sign-in.
  const [failed, setFailed] = useState<{
    portal: Role;
    failure: SignInFailure;
  } | null>(null);
  const failure = failed && failed.portal === portal ? failed.failure : null;
  // Set when the visitor follows the "Continue to ... sign in" link, so the
  // other page opens ready to submit.
  const [handoff, setHandoff] = useState<Role | null>(null);
  const [busy, setBusy] = useState(false);
  // Set when an unverified account asks for its code from this page.
  const [verifying, setVerifying] = useState<string | null>(null);
  const [codeError, setCodeError] = useState<string | null>(null);

  if (status === 'signedIn' && profile) {
    if (profile.role === portal) {
      return <Navigate to={HOME[portal]} replace />;
    }
    // Signed in with the other role: this portal stays closed until they
    // sign out.
    return (
      <AuthLayout>
        <section className="auth-card">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="card-title">
            You are signed in as {PORTAL_COPY[profile.role].accountName}
          </h1>
          <p className="card-text">
            {portal === 'advisor'
              ? 'The advisor portal is only for Academic Advisors.'
              : 'The student portal is only for students.'}{' '}
            To use it, sign out first and then sign in with{' '}
            {copy.accountName} account.
          </p>
          <Link className="button-primary" to={HOME[profile.role]}>
            Go to my dashboard
          </Link>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void signOut()}
          >
            Sign out
          </button>
        </section>
      </AuthLayout>
    );
  }

  async function startVerification() {
    const address = email.trim().toLowerCase();
    setCodeError(null);
    const message = await resendEmailCode(address);
    if (message) {
      setCodeError(message);
    } else {
      setVerifying(address);
    }
  }

  if (verifying) {
    return (
      <AuthLayout>
        <VerifyEmailCard
          email={verifying}
          sentNow
          onCancel={() => setVerifying(null)}
        />
      </AuthLayout>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCodeError(null);
    setBusy(true);
    setFailed(null);
    setHandoff(null);
    const result = await signIn(email.trim(), password, portal);
    setFailed(result ? { portal, failure: result } : null);
    setBusy(false);
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={handleSubmit}>
        <p className="eyebrow">{copy.eyebrow}</p>
        <h1 className="card-title">{copy.title}</h1>
        <p className="card-text">{copy.text}</p>

        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {failure?.kind === 'credentials' && (
          <p className="form-error" role="alert">
            The email or password is not correct.
          </p>
        )}
        {failure?.kind === 'unconfirmed' && (
          <div className="portal-hint" role="alert">
            <strong>Your email address is not verified yet</strong>
            <span>
              We will email you a code. Enter it to activate your account.
            </span>
            <button
              type="button"
              className="portal-hint-link link-button"
              onClick={() => void startVerification()}
            >
              Send me a code
              <ArrowRightIcon size={18} />
            </button>
            {codeError && <p className="form-error">{codeError}</p>}
          </div>
        )}
        {failure?.kind === 'unknown' && (
          <p className="form-error" role="alert">
            We could not check this account. Please try again.
          </p>
        )}
        {failure?.kind === 'wrongPortal' && (
          // Not an error to fix here: the account is fine, it just belongs
          // to the other page. The email and password come along.
          <div className="portal-hint" role="alert">
            <strong>{PORTAL_COPY[failure.role].wrongPortalTitle}</strong>
            <span>{PORTAL_COPY[failure.role].wrongPortalText}</span>
            <Link
              className="portal-hint-link"
              to={`/sign-in?as=${failure.role}`}
              onClick={() => setHandoff(failure.role)}
            >
              {PORTAL_COPY[failure.role].wrongPortalLink}
              <ArrowRightIcon size={18} />
            </Link>
          </div>
        )}
        {handoff === portal && !failure && (
          <p className="portal-ready" role="status">
            Your details are filled in. Select Sign in to continue.
          </p>
        )}

        <button
          // Remounted per portal so it can take focus after a hand-off.
          key={portal}
          type="submit"
          className="button-primary"
          disabled={busy}
          autoFocus={handoff === portal}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>

        {portal === 'advisor' ? (
          <>
            <p className="auth-footnote">
              Advisor accounts are provided by the administrator, so there is
              no sign-up here.
            </p>
            <p className="auth-footnote">
              Looking for the student sign-in?{' '}
              <Link to="/sign-in?as=student">Student sign in</Link>
            </p>
          </>
        ) : (
          <>
            <p className="auth-footnote">
              New student? <Link to="/sign-up">Create an account</Link>
            </p>
            <p className="auth-footnote">
              Looking for the advisor sign-in?{' '}
              <Link to="/sign-in?as=advisor">Advisor sign in</Link>
            </p>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
