import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import '../advising/advising.css';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { useLanguage } from '../i18n/language';
import { translateMessage } from '../i18n/messages';
import { useT } from '../i18n/strings';
import { usePageTitle } from '../lib/usePageTitle';

const RESEND_WAIT_SECONDS = 60;

/**
 * Forgotten password, in two steps: the student (or advisor) asks for a
 * code by email, then enters the code with a new password. The code comes
 * from Supabase's "Reset Password" email, which shows {{ .Token }}.
 */
export function ForgotPasswordPage() {
  const t = useT();
  const { language } = useLanguage();
  usePageTitle(t.titles.forgot);
  const { status, profile, requestPasswordReset, resetPassword } = useAuth();
  const [searchParams] = useSearchParams();
  const portal = searchParams.get('as') === 'advisor' ? 'advisor' : 'student';

  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [wait, setWait] = useState(0);

  useEffect(() => {
    if (wait <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  // Only after the new password is saved: the code signs the account in
  // before the password is changed, and that must not end the flow early.
  if (done && status === 'signedIn' && profile) {
    return (
      <Navigate
        to={profile.role === 'advisor' ? '/advisor' : '/app'}
        replace
        state={{ notice: t.auth.passwordReset }}
      />
    );
  }

  const say = (message: string) => translateMessage(message, language);

  async function handleRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    setBusy(true);
    setError(null);
    const message = await requestPasswordReset(address);
    setBusy(false);
    if (message) {
      setError(say(message));
      return;
    }
    setSentTo(address);
    setWait(RESEND_WAIT_SECONDS);
  }

  async function handleResend() {
    if (!sentTo) {
      return;
    }
    setError(null);
    setNotice(null);
    const message = await requestPasswordReset(sentTo);
    if (message) {
      setError(say(message));
    } else {
      setNotice(t.auth.newCodeSent);
      setWait(RESEND_WAIT_SECONDS);
    }
  }

  async function handleReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!sentTo) {
      return;
    }
    setError(null);
    setNotice(null);
    if (password !== confirm) {
      setError(t.auth.passwordsDiffer);
      return;
    }
    setBusy(true);
    const message = await resetPassword(sentTo, code.trim(), password);
    if (message) {
      setError(say(message));
      setBusy(false);
      return;
    }
    setDone(true);
  }

  const signInPath = `/sign-in?as=${portal}`;

  if (!sentTo) {
    return (
      <AuthLayout>
        <form className="auth-card" onSubmit={handleRequest}>
          <h1 className="card-title">{t.auth.forgotTitle}</h1>
          <p className="card-text">{t.auth.forgotText}</p>
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
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? t.auth.sending : t.auth.sendResetCode}
          </button>
          <p className="auth-footnote">
            {t.auth.rememberedIt}{' '}
            <Link to={signInPath}>{t.auth.backToSignIn}</Link>
          </p>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={handleReset}>
        <h1 className="card-title">{t.auth.resetCodeTitle}</h1>
        <p className="card-text">{t.auth.resetCodeText(sentTo)}</p>

        <label className="field">
          <span>{t.auth.verificationCode}</span>
          <input
            name="code"
            className="code-input"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            title={t.auth.codeHint}
            maxLength={10}
            required
            autoFocus
            value={code}
            onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
          />
        </label>
        {/* The rule sits outside the label so it is read as a description. */}
        <div className="field">
          <label htmlFor="reset-new-password">{t.auth.newPassword}</label>
          <input
            id="reset-new-password"
            type="password"
            name="new-password"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-describedby="reset-new-password-rule"
          />
          <span id="reset-new-password-rule" className="field-note">
            {t.auth.passwordRule}
          </span>
        </div>
        <label className="field">
          <span>{t.auth.confirmPassword}</span>
          <input
            type="password"
            name="confirm-password"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="portal-ready" role="status">
            {notice}
          </p>
        )}

        <button type="submit" className="button-primary" disabled={busy}>
          {busy ? t.auth.saving : t.auth.saveNewPassword}
        </button>
        <button
          type="button"
          className="button-secondary"
          disabled={wait > 0}
          onClick={() => void handleResend()}
        >
          {wait > 0 ? t.auth.newCodeIn(wait) : t.auth.newCode}
        </button>
        <p className="auth-footnote">
          {t.auth.wrongAddress}{' '}
          <button
            type="button"
            className="link-button"
            onClick={() => {
              setSentTo(null);
              setCode('');
              setError(null);
              setNotice(null);
            }}
          >
            {t.auth.goBack}
          </button>
        </p>
      </form>
    </AuthLayout>
  );
}
