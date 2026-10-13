import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowRightIcon } from '../components/Icons';
import { fetchMyScreenings, requestFeedback } from '../lib/api';
import {
  BINARY_LABELS,
  CATEGORY_CONTENT,
  WORKLOAD_LABELS,
} from '../screening/content';
import { toHistoryItem } from '../screening/types';
import type {
  ScreeningHistoryItem,
  SubmittedScreening,
} from '../screening/types';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function ResultPage() {
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
  const savedNote = item ? item.feedbackText : null;
  const [requested, setRequested] = useState<{
    id: string;
    text: string | null;
  } | null>(null);

  useEffect(() => {
    if (!itemId || savedNote) {
      return;
    }
    let active = true;
    requestFeedback(itemId)
      .then((result) => {
        if (active) {
          setRequested({ id: itemId, text: result.feedbackText });
        }
      })
      .catch(() => {
        // No note is fine: the result page is complete without it.
        if (active) {
          setRequested({ id: itemId, text: null });
        }
      });
    return () => {
      active = false;
    };
  }, [itemId, savedNote]);

  const noteAnswered = requested !== null && requested.id === itemId;
  const noteText = savedNote ?? (noteAnswered ? requested.text : null);
  const noteLoading = itemId !== null && !savedNote && !noteAnswered;

  if (loading) {
    return <p className="page-message">Loading your result…</p>;
  }
  if (!item) {
    return (
      <div className="page">
        <p className="page-message">
          {failed
            ? 'We could not load this result. Please try again.'
            : 'We could not find this result.'}
        </p>
        <Link className="text-link" to="/app">
          Back to overview
        </Link>
      </div>
    );
  }

  const content = CATEGORY_CONTENT[item.category];

  return (
    <div className="page page-narrow">
      <p className="eyebrow">
        Your screening result · {dateFormat.format(new Date(item.createdAt))}
      </p>

      {/* The Rule-Based category is the primary information on this page. */}
      <section className={`result-card result-${content.tone}`}>
        <p className="result-kicker">Screening category</p>
        <h1 className="result-title">{content.label}</h1>
        <p className="result-summary">{content.summary}</p>
      </section>

      <section className="card">
        <p className="eyebrow">What this is based on</p>
        <div className="metric-row">
          <div className="metric">
            <span className="metric-label">Academic workload</span>
            <span className="metric-value">
              {WORKLOAD_LABELS[item.workload.level]}
            </span>
            <span className="metric-note">
              Score {item.workload.score} out of 100
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Exhaustion</span>
            <span className="metric-value">
              {BINARY_LABELS[item.exhaustion.level]}
            </span>
          </div>
          <div className="metric">
            <span className="metric-label">Disengagement</span>
            <span className="metric-value">
              {BINARY_LABELS[item.disengagement.level]}
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        <p className="eyebrow">Recommended next step</p>
        <p className="card-text">{content.nextStep}</p>
      </section>

      {/* AI explanation: secondary to the category above, and optional. */}
      {(noteLoading || noteText) && (
        <section className="card card-soft" aria-live="polite">
          <p className="eyebrow">A note for you</p>
          {noteText ? (
            <>
              {noteText.split(/\n{2,}/).map((paragraph, index) => (
                <p key={index} className="card-text note-text">
                  {paragraph}
                </p>
              ))}
              <p className="fine-print">
                Written by AI to explain your result.
              </p>
            </>
          ) : (
            <p className="card-text">Writing a short note for you…</p>
          )}
        </section>
      )}

      <p className="fine-print">
        This is a screening result, not a diagnosis. The category was
        determined by fixed rules applied to your answers.
      </p>

      <div className="button-row">
        <Link className="button-secondary" to="/app">
          Back to overview
        </Link>
        <Link className="text-link" to="/app/support">
          Open Support chat <ArrowRightIcon size={18} />
        </Link>
      </div>
    </div>
  );
}
