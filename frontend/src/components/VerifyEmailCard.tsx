import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/useAuth';
import { useLanguage } from '../i18n/language';
import { translateMessage } from '../i18n/messages';
import { useT } from '../i18n/strings';

const RESEND_WAIT_SECONDS = 60;

/**
 * Asks for the code that Supabase emailed to confirm a new account. Once the
 * code is accepted the account is signed in, and the page around this card
 * takes the visitor to their workspace.
 */
export function VerifyEmailCard({
  email,
  sentNow,
  onCancel,
}: {
  email: string;
  /** True when a code was sent just before this card appeared. */
  sentNow: boolean;
  onCancel: () => void;
}) {
  const { verifyEmailCode, resendEmailCode } = useAuth();
  const t = useT();
  const { language } = useLanguage();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [wait, setWait] = useState(sentNow ? RESEND_WAIT_SECONDS : 0);

  useEffect(() => {
    if (wait <= 0) {
      return;
    }
    const timer = window.setTimeout(() => setWait((value) => value - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [wait]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);
    const message = await verifyEmailCode(email, code.trim());
    if (message) {
      setError(translateMessage(message, language));
      setBusy(false);
    }
    // On success the session starts and the page redirects.
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    const message = await resendEmailCode(email);
    if (message) {
      setError(translateMessage(message, language));
    } else {
      setNotice(t.auth.newCodeSent);
      setWait(RESEND_WAIT_SECONDS);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h1 className="card-title">{t.auth.checkEmail}</h1>
      <p className="card-text">
        {t.auth.verifyText(sentNow ? t.auth.weSent : t.auth.enter, email)}
      </p>

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
        {busy ? t.auth.checking : t.auth.verifyButton}
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
        <button type="button" className="link-button" onClick={onCancel}>
          {t.auth.goBack}
        </button>
      </p>
    </form>
  );
}
