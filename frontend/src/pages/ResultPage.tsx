import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRightIcon } from '../components/Icons';
import { fetchMyScreenings, requestFeedback } from '../lib/api';
import { UrgentHelpCard } from '../components/UrgentHelpCard';
import { localeOf, useLanguage } from '../i18n/language';
import { useScreeningContent } from '../i18n/screening-content';
import { useT } from '../i18n/strings';
import { toHistoryItem } from '../screening/types';
import type {
  ScreeningHistoryItem,
  SubmittedScreening,
} from '../screening/types';
import { usePageTitle } from '../lib/usePageTitle';

export function ResultPage() {
  const t = useT();
  const { language } = useLanguage();
  const screening = useScreeningContent();
  usePageTitle(t.titles.result);
  const dateFormat = new Intl.DateTimeFormat(localeOf(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  const { id } = useParams<{ id: string }>();
  const location = useLocation();

  // Arriving straight from the screening: the result is already in hand.
  const passed = (location.state as { result?: SubmittedScreening } | null)
    ?.result;
  const submitted = passed && passed.id === id ? passed : null;

  const [fetched, setFetched] = useState<{
    id: string;
    item: ScreeningHistoryItem | null;
  } | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    if (submitted || !id) {
      return;
    }
    let active = true;
    fetchMyScreenings()
      .then((list) => {
        if (active) {
          setFetched({ id, item: list.find((entry) => entry.id === id) ?? null });
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
  }, [id, submitted]);

  const item = submitted
    ? toHistoryItem(submitted)
    : fetched && fetched.id === id
      ? fetched.item
      : null;
  const loading = !submitted && !failed && (!fetched || fetched.id !== id);

  // "A note for you": requested after the result is known, so the
  // rule-based category is on screen first and never waits for the AI.
  const itemId = item ? item.id : null;
  // Each language has its own note.
  const savedNote = item
    ? language === 'id'
      ? (item.feedbackTextId ?? null)
      : item.feedbackText
    : null;
  const noteKey = itemId ? `${itemId}:${language}` : null;
  const [requested, setRequested] = useState<{
    id: string;
    text: string | null;
  } | null>(null);

  useEffect(() => {
    if (!itemId || !noteKey || savedNote) {
      return;
    }
    let active = true;
    requestFeedback(itemId, language)
      .then((result) => {
        if (active) {
          setRequested({ id: noteKey, text: result.feedbackText });
        }
      })
      .catch(() => {
        // No note is fine: the result page is complete without it.
        if (active) {
          setRequested({ id: noteKey, text: null });
        }
      });
    return () => {
      active = false;
    };
  }, [itemId, noteKey, language, savedNote]);

  const noteAnswered = requested !== null && requested.id === noteKey;
  const noteText = savedNote ?? (noteAnswered ? requested.text : null);
  const noteLoading = itemId !== null && !savedNote && !noteAnswered;

  if (loading) {
    return <p className="page-message">{t.result.loading}</p>;
  }
  if (!item) {
    return (
      <div className="page">
        <p className="page-message">
          {failed ? t.result.loadFailed : t.result.notFound}
        </p>
        <Link className="text-link" to="/app">
          {t.result.backToOverview}
        </Link>
      </div>
    );
  }

  const content = screening.categories[item.category];

  return (
    <div className="page page-narrow">
      <p className="eyebrow">
        {t.result.kicker(dateFormat.format(new Date(item.createdAt)))}
      </p>

      {/* The Rule-Based category is the primary information on this page. */}
      <section className={`result-card result-${content.tone}`}>
        <p className="result-kicker">{t.result.category}</p>
        <h1 className="result-title">{content.label}</h1>
        <p className="result-summary">{content.summary}</p>
      </section>

      <section className="card">
        <p className="eyebrow">{t.result.basedOn}</p>
        <p className="card-text">{t.result.basedOnText}</p>
        <div className="metric-row">
          <div className="metric">
            <span className="metric-label">{t.result.workload}</span>
            <span className="metric-value">
              {screening.workloadLabels[item.workload.level]}
            </span>
            <span className="metric-note">{screening.measureHints.workload}</span>
            <span className="metric-note">
              {t.result.score(item.workload.score)}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">{t.result.exhaustion}</span>
            <span className="metric-value">
              {screening.binaryLabels[item.exhaustion.level]}
            </span>
            <span className="metric-note">
              {screening.measureHints.exhaustion}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">{t.result.disengagement}</span>
            <span className="metric-value">
              {screening.binaryLabels[item.disengagement.level]}
            </span>
            <span className="metric-note">
              {screening.measureHints.disengagement}
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">{t.result.nextStep}</p>
        <p className="card-text">{content.nextStep}</p>
      </section>

      {/* Support that does not have to wait for an appointment. */}
      {item.category === 'HIGH_RISK' && <UrgentHelpCard variant="result" />}

      {/* AI explanation: secondary to the category above, and optional. */}
      {(noteLoading || noteText) && (
        <section className="card card-soft" aria-live="polite">
          <p className="eyebrow">{t.result.note}</p>
          {noteText ? (
            <>
              {noteText.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index} className="card-text note-text">
                  {paragraph}
                </p>
              ))}
              <p className="fine-print">{t.result.noteByAi}</p>
            </>
          ) : (
            <p className="card-text">{t.result.writingNote}</p>
          )}
        </section>
      )}

      <section className="card">
        <details className="rule-details about-burnout">
          <summary>{t.result.whatIsBurnout}</summary>
          {t.result.burnoutText.map((paragraph) => (
            <p key={paragraph} className="card-text">
              {paragraph}
            </p>
          ))}
        </details>
      </section>

      <p className="fine-print">{t.result.disclaimer}</p>

      <div className="button-row">
        <Link className="button-secondary" to="/app">
          {t.result.backToOverview}
        </Link>
        <Link className="text-link" to="/app/support">
          {t.result.openChat} <ArrowRightIcon size={18} />
        </Link>
      </div>
    </div>
  );
}
