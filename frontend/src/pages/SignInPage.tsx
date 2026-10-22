import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useLocation, useSearchParams } from 'react-router-dom';
import '../advising/advising.css';
import type { Role, SignInFailure } from '../auth/auth-context';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { ArrowRightIcon, BookIcon, PeopleIcon } from '../components/Icons';
import { VerifyEmailCard } from '../components/VerifyEmailCard';
import { useLanguage } from '../i18n/language';
import { translateMessage } from '../i18n/messages';
import { useT } from '../i18n/strings';
import type { Strings } from '../i18n/strings';
import { usePageTitle } from '../lib/usePageTitle';

/**
 * Wording for each portal. Every sign-in belongs to exactly one portal, and
 * a portal only accepts accounts with its own role.
 */
function portalCopy(t: Strings): Record<
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
> {
  return {
    student: {
      eyebrow: t.auth.studentPortal,
      title: t.auth.studentTitle,
      text: t.auth.studentText,
      accountName: t.auth.aStudent,
      wrongPortalTitle: t.auth.studentAccount,
      wrongPortalText: t.auth.studentsOwnPage,
      wrongPortalLink: t.auth.toStudent,
    },
    advisor: {
      eyebrow: t.auth.advisorPortal,
      title: t.auth.advisorTitle,
      text: t.auth.advisorText,
      accountName: t.auth.anAdvisor,
      wrongPortalTitle: t.auth.advisorAccount,
      wrongPortalText: t.auth.advisorsOwnPage,
      wrongPortalLink: t.auth.toAdvisor,
    },
  };
}

/**
 * Two tabs above the form: which sign-in this is, and the way to the other.
 * The marker slides to the chosen side and each portal has its own colour.
 */
function PortalSwitch({ portal }: { portal: Role }) {
  const t = useT();
  return (
    <nav className={`portal-switch on-${portal}`} aria-label={t.auth.switchLabel}>
      <span className="portal-switch-label">{t.auth.switchLabel}</span>
      <span className="portal-switch-tabs">
        <span className="portal-switch-marker" aria-hidden="true" />
        <Link
          to="/sign-in?as=student"
          replace
          aria-current={portal === 'student' ? 'page' : undefined}
        >
          <BookIcon size={16} /> {t.auth.studentTab}
        </Link>
        <Link
          to="/sign-in?as=advisor"
          replace
          aria-current={portal === 'advisor' ? 'page' : undefined}
        >
          <PeopleIcon size={16} /> {t.auth.advisorTab}
        </Link>
      </span>
    </nav>
  );
}

const HOME: Record<Role, string> = { student: '/app', advisor: '/advisor' };

export function SignInPage() {
  const t = useT();
  const { language } = useLanguage();
  usePageTitle(t.titles.signIn);
  const PORTAL_COPY = portalCopy(t);
  const { status, profile, signIn, signOut, resendEmailCode } = useAuth();
  const [searchParams] = useSearchParams();
  // The page the visitor was trying to open before signing in, if any.
  const from = (useLocation().state as { from?: string } | null)?.from;
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
      const back = from && from.startsWith(HOME[portal]) ? from : HOME[portal];
      return <Navigate to={back} replace />;
    }
    // Signed in with the other role: this portal stays closed until they
    // sign out.
    return (
      <AuthLayout>
        <section className="auth-card">
          <p className="eyebrow">{copy.eyebrow}</p>
          <h1 className="card-title">
            {t.auth.signedInAs(PORTAL_COPY[profile.role].accountName)}
          </h1>
          <p className="card-text">
            {portal === 'advisor' ? t.auth.advisorOnly : t.auth.studentOnly}{' '}
            {t.auth.signOutFirst(copy.accountName)}
          </p>
          <Link className="button-primary" to={HOME[profile.role]}>
            {t.auth.goToMyDashboard}
          </Link>
          <button
            type="button"
            className="button-secondary"
            onClick={() => void signOut()}
          >
            {t.common.signOut}
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
      setCodeError(translateMessage(message, language));
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
      <PortalSwitch portal={portal} />
      {/* Remounted per portal, so it slides in and the change is seen. */}
      <form
        key={portal}
        className={`auth-card portal-card portal-${portal}`}
        onSubmit={handleSubmit}
      >
        <div className="portal-head">
          <span className="portal-badge" aria-hidden="true">
            {portal === 'advisor' ? <PeopleIcon size={22} /> : <BookIcon size={22} />}
          </span>
          <p className="eyebrow">{copy.eyebrow}</p>
        </div>
        <h1 className="card-title">{copy.title}</h1>
        <p className="card-text">{copy.text}</p>
        <p className="visually-hidden" role="status">
          {t.auth.nowOn(portal === 'advisor' ? t.auth.advisorTab : t.auth.studentTab)}
        </p>

        <label className="field">
          <span>{t.common.email}</span>
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
          <span>{t.common.password}</span>
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
            {t.auth.wrongCredentials}
          </p>
        )}
        {failure?.kind === 'unconfirmed' && (
          <div className="portal-hint" role="alert">
            <strong>{t.auth.unverifiedTitle}</strong>
            <span>{t.auth.unverifiedText}</span>
            <button
              type="button"
              className="portal-hint-link link-button"
              onClick={() => void startVerification()}
            >
              {t.auth.sendCode}
              <ArrowRightIcon size={18} />
            </button>
            {codeError && <p className="form-error">{codeError}</p>}
          </div>
        )}
        {failure?.kind === 'unknown' && (
          <p className="form-error" role="alert">
            {t.auth.unknownError}
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
            {t.auth.detailsFilled}
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
          {busy ? t.auth.signingIn : t.common.signIn}
        </button>

        <p className="auth-footnote auth-forgot">
          <Link to={`/forgot-password?as=${portal}`}>
            {t.auth.forgotPassword}
          </Link>
        </p>

        {portal === 'advisor' ? (
          <>
            <p className="auth-footnote">{t.auth.advisorNoSignUp}</p>
            <p className="auth-footnote">
              {t.auth.lookingForStudent}{' '}
              <Link to="/sign-in?as=student">{t.auth.studentTitle}</Link>
            </p>
          </>
        ) : (
          <>
            <p className="auth-footnote">
              {t.auth.newStudent}{' '}
              <Link to="/sign-up">{t.auth.createAccount}</Link>
            </p>
            <p className="auth-footnote">
              {t.auth.lookingForAdvisor}{' '}
              <Link to="/sign-in?as=advisor">{t.auth.advisorTitle}</Link>
            </p>
          </>
        )}
      </form>
    </AuthLayout>
  );
}
