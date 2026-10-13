import { useState } from 'react';
import type { FormEvent } from 'react';
import '../advising/advising.css';
import { joinAdvisor, previewAdvisor } from '../advising/api';
import type { MyAdvisor } from '../advising/api';
import { ApiError } from '../lib/api';
import { ArrowRightIcon } from './Icons';

function messageOf(error: unknown): string {
  return error instanceof ApiError
    ? error.message
    : 'Something went wrong. Please try again.';
}

/**
 * Connects a student to their Academic Advisor in two steps: enter the
 * advisor's code, then confirm the advisor's name before linking.
 */
export function LinkAdvisorCard({
  current,
  onLinked,
  onCancel,
}: {
  /** The advisor the student is linked to now, when changing advisors. */
  current?: MyAdvisor | null;
  onLinked: (advisor: MyAdvisor) => void;
  onCancel?: () => void;
}) {
  const [code, setCode] = useState('');
  const [found, setFound] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFind(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await previewAdvisor(code);
      setFound(result.advisor.fullName);
    } catch (caught) {
      setError(messageOf(caught));
    }
    setBusy(false);
  }

  async function handleConfirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await joinAdvisor(code);
      onLinked(result.advisor);
    } catch (caught) {
      setError(messageOf(caught));
      setBusy(false);
    }
  }

  if (found !== null) {
    return (
      <section className="card link-card">
        <p className="eyebrow">Confirm your advisor</p>
        <h2 className="card-title">Is this your Academic Advisor?</h2>
        <p className="confirm-name">{found || 'Unnamed advisor'}</p>
        <p className="card-text">
          Once you connect, your screening results are shared with this
          advisor so they can offer support.
        </p>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button
            type="button"
            className="button-primary"
            disabled={busy}
            onClick={handleConfirm}
          >
            {busy ? 'Connecting…' : 'Yes, connect'}
          </button>
          <button
            type="button"
            className="button-secondary"
            disabled={busy}
            onClick={() => {
              setFound(null);
              setError(null);
            }}
          >
            No, enter another code
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card link-card">
      <p className="eyebrow">
        {current ? 'Change advisor' : 'Before your first screening'}
      </p>
      <h2 className="card-title">
        {current
          ? 'Connect to a different Academic Advisor'
          : 'Connect to your Academic Advisor'}
      </h2>
      <p className="card-text">
        {current
          ? `You are connected to ${current.fullName}. Enter another advisor’s code to switch.`
          : 'Ask your Academic Advisor (DPA) for their code and enter it here. Your screening results are shared with them so they can offer support.'}
      </p>
      <form onSubmit={handleFind} className="link-card">
        <label className="field">
          <span>Advisor code</span>
          <input
            className="code-input"
            name="code"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            placeholder="AB2C-9KMP"
            required
            value={code}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <div className="button-row">
          <button type="submit" className="button-primary" disabled={busy}>
            {busy ? 'Checking…' : 'Find my advisor'}{' '}
            {!busy && <ArrowRightIcon size={18} />}
          </button>
          {onCancel && (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={onCancel}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
