import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuth } from '../auth/useAuth';

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
      setError(message);
      setBusy(false);
    }
    // On success the session starts and the page redirects.
  }

  async function handleResend() {
    setError(null);
    setNotice(null);
    const message = await resendEmailCode(email);
    if (message) {
      setError(message);
    } else {
      setNotice('A new code is on its way. Codes from earlier emails no longer work.');
      setWait(RESEND_WAIT_SECONDS);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h1 className="card-title">Check your email</h1>
      <p className="card-text">
        {sentNow ? 'We sent' : 'Enter'} a verification code to{' '}
        <strong>{email}</strong>. Enter it below to activate your account. The
        email can take a minute to arrive; check your spam folder too.
      </p>

      <label className="field">
        <span>Verification code</span>
        <input
          name="code"
          className="code-input"
          inputMode="numeric"
          autoComplete="one-time-code"
          pattern="[0-9]{6,10}"
          title="The code from the email (digits only)"
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
        {busy ? 'Checking…' : 'Verify and continue'}
      </button>
      <button
        type="button"
        className="button-secondary"
        disabled={wait > 0}
        onClick={() => void handleResend()}
      >
        {wait > 0 ? `Send a new code (${wait}s)` : 'Send a new code'}
      </button>
      <p className="auth-footnote">
        Wrong address?{' '}
        <button type="button" className="link-button" onClick={onCancel}>
          Go back
        </button>
      </p>
    </form>
  );
}
