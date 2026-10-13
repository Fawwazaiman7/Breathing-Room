import { useEffect, useState } from 'react';
import '../advising/advising.css';
import { fetchInviteCode, regenerateInviteCode } from '../advising/api';

/** The advisor's own invite code, with copy and replace actions. */
export function InviteCodeCard() {
  const [code, setCode] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  const [copyState, setCopyState] = useState<'idle' | 'copied' | 'unavailable'>(
    'idle',
  );
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchInviteCode()
      .then((result) => {
        if (active) {
          setCode(result.code);
        }
      })
      .catch(() => {
        if (active) {
          setFailed(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  async function handleCopy() {
    if (!code) {
      return;
    }
    try {
      await navigator.clipboard.writeText(code);
      setCopyState('copied');
    } catch {
      // The browser can block clipboard access (for example on a page that
      // is not served over HTTPS). The code is on screen to copy by hand.
      setCopyState('unavailable');
    }
  }

  async function handleRegenerate() {
    setBusy(true);
    try {
      const result = await regenerateInviteCode();
      setCode(result.code);
      setCopyState('idle');
      setFailed(false);
      setConfirming(false);
    } catch {
      setFailed(true);
    }
    setBusy(false);
  }

  return (
    <section className="card code-card">
      <p className="eyebrow">Your advisor code</p>
      <h2 className="card-title">Share this code with your students</h2>
      <p className="card-text">
        A student enters it once to connect to you. After that, their
        screening results appear in your list.
      </p>

      {failed && (
        <p className="form-error" role="alert">
          We could not load your code. Please refresh the page.
        </p>
      )}
      {!failed && code === null && <p className="card-text">Loading…</p>}
      {code !== null && (
        <div className="code-row">
          <span className="code-display" aria-label="Advisor code">
            {code}
          </span>
          <button
            type="button"
            className="button-secondary button-small"
            onClick={handleCopy}
          >
            {copyState === 'copied' ? 'Copied' : 'Copy'}
          </button>
          {!confirming && (
            <button
              type="button"
              className="link-button"
              onClick={() => setConfirming(true)}
            >
              Create a new code
            </button>
          )}
        </div>
      )}

      {copyState === 'unavailable' && (
        <p className="fine-print">
          Copying is not available in this browser. Select the code and copy
          it by hand.
        </p>
      )}

      {confirming && (
        <div className="inline-confirm">
          <p>
            The current code will stop working. Students who are already
            connected stay connected.
          </p>
          <button
            type="button"
            className="button-primary button-small"
            disabled={busy}
            onClick={handleRegenerate}
          >
            {busy ? 'Creating…' : 'Create new code'}
          </button>
          <button
            type="button"
            className="button-secondary button-small"
            disabled={busy}
            onClick={() => setConfirming(false)}
          >
            Keep current code
          </button>
        </div>
      )}
    </section>
  );
}
