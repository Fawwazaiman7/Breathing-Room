import { useState } from 'react';
import type { FormEvent } from 'react';
import '../advising/advising.css';
import { joinAdvisor, previewAdvisor } from '../advising/api';
import type { MyAdvisor } from '../advising/api';
import { useLanguage } from '../i18n/language';
import { translateMessage } from '../i18n/messages';
import { useT } from '../i18n/strings';
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
  const t = useT();
  const { language } = useLanguage();
  const say = (caught: unknown) => translateMessage(messageOf(caught), language);
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
      setError(say(caught));
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
      setError(say(caught));
      setBusy(false);
    }
  }

  if (found !== null) {
    return (
      <section className="card link-card" data-tour="advisor">
        <p className="eyebrow">{t.link.confirmKicker}</p>
        <h2 className="card-title">{t.link.confirmTitle}</h2>
        <p className="confirm-name">{found || t.common.unnamedAdvisor}</p>
        <p className="card-text">{t.link.confirmText}</p>
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
            {busy ? t.link.connecting : t.link.yes}
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
            {t.link.no}
          </button>
        </div>
      </section>
    );
  }

  return (
    <section className="card link-card" data-tour="advisor">
      <p className="eyebrow">
        {current ? t.link.changeKicker : t.link.firstKicker}
      </p>
      <h2 className="card-title">
        {current ? t.link.changeTitle : t.link.firstTitle}
      </h2>
      <p className="card-text">
        {current ? t.link.changeText(current.fullName) : t.link.firstText}
      </p>
      <form onSubmit={handleFind} className="link-card">
        <label className="field">
          <span>{t.link.code}</span>
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
            {busy ? t.link.checking : t.link.find}{' '}
            {!busy && <ArrowRightIcon size={18} />}
          </button>
          {onCancel && (
            <button
              type="button"
              className="button-secondary"
              disabled={busy}
              onClick={onCancel}
            >
              {t.common.cancel}
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
