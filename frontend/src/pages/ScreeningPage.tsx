import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyAdvisor } from '../advising/useMyAdvisor';
import { useAuth } from '../auth/useAuth';
import { ArrowLeftIcon, ArrowRightIcon } from '../components/Icons';
import { LinkAdvisorCard } from '../components/LinkAdvisorCard';
import { ApiError, submitScreening } from '../lib/api';
import { useLanguage } from '../i18n/language';
import { translateMessage } from '../i18n/messages';
import { useScreeningContent } from '../i18n/screening-content';
import { useT } from '../i18n/strings';
import {
  NASA_TLX_DIMENSIONS,
  NASA_TLX_PAIRS,
  OLBI_STATEMENTS,
} from '../screening/content';
import { clearDraft, loadDraft, saveDraft } from '../screening/draft';
import {
  PartOneHowTo,
  PartStepper,
  PartTwoHowTo,
} from '../screening/HowTo';
import type { NasaTlxDimension, ScreeningPayload } from '../screening/types';
import { usePageTitle } from '../lib/usePageTitle';

type Step =
  | { kind: 'intro' }
  | { kind: 'compare'; index: number }
  | { kind: 'rate'; index: number }
  | { kind: 'olbiIntro' }
  | { kind: 'olbi'; index: number }
  | { kind: 'review' };

const STEPS: Step[] = [
  { kind: 'intro' },
  ...NASA_TLX_PAIRS.map((_pair, index) => ({ kind: 'compare' as const, index })),
  ...NASA_TLX_DIMENSIONS.map((_dimension, index) => ({
    kind: 'rate' as const,
    index,
  })),
  { kind: 'olbiIntro' },
  ...OLBI_STATEMENTS.map((_statement, index) => ({
    kind: 'olbi' as const,
    index,
  })),
  { kind: 'review' },
];

const PART_ONE_TOTAL = NASA_TLX_PAIRS.length + NASA_TLX_DIMENSIONS.length;
const PART_TWO_TOTAL = OLBI_STATEMENTS.length;
const RATING_START = 50;

/** Pause between choosing an answer and moving to the next question. */
const ADVANCE_DELAY_MS = 700;

function replaceAt<T>(list: T[], index: number, value: T): T[] {
  const copy = [...list];
  copy[index] = value;
  return copy;
}

function Progress({
  label,
  position,
  total,
}: {
  label: string;
  position: number;
  total: number;
}) {
  const t = useT();
  return (
    <div className="flow-progress">
      <div className="flow-progress-labels">
        <span>{label}</span>
        <span>{t.screening.of(position, total)}</span>
      </div>
      <div
        className="flow-progress-track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={position}
      >
        <div
          className="flow-progress-fill"
          style={{ width: `${(position / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

/**
 * A student connects to their Academic Advisor before screening, because
 * results are shared with that advisor. The backend enforces the same rule.
 */
export function ScreeningPage() {
  const t = useT();
  usePageTitle(t.titles.screening);
  const { state, setAdvisor } = useMyAdvisor();

  if (state.status === 'loading') {
    return <p className="page-message">{t.common.loading}</p>;
  }
  if (state.status === 'error') {
    return <p className="page-message">{t.screening.loadAdvisorFailed}</p>;
  }
  if (!state.advisor) {
    return (
      <div className="page page-narrow">
        <LinkAdvisorCard onLinked={setAdvisor} />
      </div>
    );
  }
  return (
    <ScreeningFlow
      advisorName={state.advisor.fullName || t.common.yourAdvisor}
    />
  );
}

/** Restores unfinished answers once, when the flow first appears. */
function useInitialDraft(userId: string | null) {
  const [draft] = useState(() =>
    userId ? loadDraft(userId, STEPS.length) : null,
  );
  return draft;
}

function ScreeningFlow({ advisorName }: { advisorName: string }) {
  const navigate = useNavigate();
  const t = useT();
  const { language } = useLanguage();
  const content = useScreeningContent();
  const { profile } = useAuth();
  const userId = profile?.id ?? null;
  const draft = useInitialDraft(userId);
  const [stepIndex, setStepIndex] = useState(draft?.stepIndex ?? 0);
  const [choices, setChoices] = useState<(NasaTlxDimension | null)[]>(
    () => draft?.choices ?? NASA_TLX_PAIRS.map(() => null),
  );
  const [ratings, setRatings] = useState<(number | null)[]>(
    () => draft?.ratings ?? NASA_TLX_DIMENSIONS.map(() => null),
  );
  const [answers, setAnswers] = useState<(number | null)[]>(
    () => draft?.answers ?? OLBI_STATEMENTS.map(() => null),
  );
  const [restored, setRestored] = useState(draft !== null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep unfinished answers on this device, so leaving the app (which can
  // make a phone browser reload the page) does not lose them.
  useEffect(() => {
    if (!userId || submitting || stepIndex === 0) {
      return;
    }
    saveDraft(userId, { stepIndex, choices, ratings, answers });
  }, [userId, stepIndex, choices, ratings, answers, submitting]);

  const step = STEPS[stepIndex];

  // A short pause after a choice before the next question appears. The
  // selected answer shows straight away, so the student sees what they
  // picked, and a mistaken tap can be changed within the pause. The next
  // question's buttons also no longer appear right under a finger that is
  // still on the screen.
  const advanceTimer = useRef<number | null>(null);

  function cancelAdvance() {
    if (advanceTimer.current !== null) {
      window.clearTimeout(advanceTimer.current);
      advanceTimer.current = null;
    }
  }

  useEffect(() => cancelAdvance, []);

  function chooseAndAdvance(record: () => void) {
    record();
    cancelAdvance();
    advanceTimer.current = window.setTimeout(() => {
      advanceTimer.current = null;
      goNext();
    }, ADVANCE_DELAY_MS);
  }

  function goNext() {
    cancelAdvance();
    setRestored(false);
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
    cancelAdvance();
    setRestored(false);
    if (stepIndex === 0) {
      navigate('/app');
    } else {
      setStepIndex((current) => current - 1);
    }
  }

  async function handleSubmit() {
    const complete =
      choices.every((choice) => choice !== null) &&
      ratings.every((rating) => rating !== null) &&
      answers.every((answer) => answer !== null);
    if (!complete) {
      setError(t.screening.missing);
      return;
    }

    const payload: ScreeningPayload = {
      nasaTlx: {
        pairwiseChoices: choices as NasaTlxDimension[],
        ratings: Object.fromEntries(
          NASA_TLX_DIMENSIONS.map((dimension, index) => [
            dimension,
            ratings[index],
          ]),
        ) as Record<NasaTlxDimension, number>,
      },
      olbi: { answers: answers as number[] },
    };

    setSubmitting(true);
    setError(null);
    try {
      const result = await submitScreening(payload);
      if (userId) {
        clearDraft(userId);
      }
      navigate(`/app/results/${result.id}`, { state: { result } });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? translateMessage(caught.message, language)
          : t.common.somethingWrong,
      );
      setSubmitting(false);
    }
  }

  if (submitting) {
    return (
      <div className="flow">
        <div className="flow-body flow-center" role="status">
          <span className="spinner" aria-hidden="true" />
          <h1 className="flow-title">{t.screening.putting}</h1>
          <p className="flow-sub">{t.screening.moment}</p>
        </div>
      </div>
    );
  }

  let progress: { label: string; position: number; total: number } | null =
    null;
  if (step.kind === 'compare') {
    progress = {
      label: t.screening.workloadProgress,
      position: step.index + 1,
      total: PART_ONE_TOTAL,
    };
  } else if (step.kind === 'rate') {
    progress = {
      label: t.screening.workloadProgress,
      position: NASA_TLX_PAIRS.length + step.index + 1,
      total: PART_ONE_TOTAL,
    };
  } else if (step.kind === 'olbi') {
    progress = {
      label: t.screening.feelingProgress,
      position: step.index + 1,
      total: PART_TWO_TOTAL,
    };
  }

  return (
    <div className="flow">
      <button type="button" className="back-button" onClick={goBack}>
        <ArrowLeftIcon size={18} /> {t.common.back}
      </button>

      {progress && <Progress {...progress} />}

      {restored && (
        <p className="flow-restored" role="status">
          {t.screening.restored}
        </p>
      )}

      <div className="flow-body">
        {step.kind === 'intro' && (
          <>
            <p className="eyebrow">{t.screening.introKicker}</p>
            <h1 className="flow-title">{t.screening.introTitle}</h1>
            <p className="flow-sub">{t.screening.introText}</p>
            <PartStepper current={1} />
            <PartOneHowTo />
            <p className="flow-note flow-share">
              {t.screening.introPoints(advisorName)[2]}
            </p>
            <button type="button" className="button-primary" onClick={goNext}>
              {t.screening.start} <ArrowRightIcon size={18} />
            </button>
          </>
        )}

        {step.kind === 'compare' && (
          <>
            <p className="eyebrow">
              {t.screening.compareKicker(step.index + 1, NASA_TLX_PAIRS.length)}
            </p>
            <h1 className="flow-title">{t.screening.compareTitle}</h1>
            <p className="flow-sub">{t.screening.compareText}</p>
            <div
              className="choice-pair"
              key={`compare-${step.index}`}
              data-or={t.screening.or}
            >
              {NASA_TLX_PAIRS[step.index].map((dimension, optionIndex) => (
                <button
                  key={dimension}
                  type="button"
                  className={
                    choices[step.index] === dimension
                      ? 'choice-card selected'
                      : 'choice-card'
                  }
                  aria-pressed={choices[step.index] === dimension}
                  onClick={() =>
                    chooseAndAdvance(() =>
                      setChoices((current) =>
                        replaceAt(current, step.index, dimension),
                      ),
                    )
                  }
                >
                  <span className="choice-letter">
                    {optionIndex === 0 ? 'A' : 'B'}
                  </span>
                  <span className="choice-label">
                    {content.dimensions[dimension].label}
                  </span>
                  <span className="choice-description">
                    {content.dimensions[dimension].description}
                  </span>
                </button>
              ))}
            </div>
            <p className="flow-note">
              {t.screening.compareNote}
            </p>
          </>
        )}

        {step.kind === 'rate' &&
          (() => {
            const dimension = NASA_TLX_DIMENSIONS[step.index];
            const dimensionText = content.dimensions[dimension];
            const rating = ratings[step.index];
            const setRating = (value: number) =>
              setRatings((current) => replaceAt(current, step.index, value));
            return (
              <>
                <p className="eyebrow">
                  {t.screening.rateKicker(
                    step.index + 1,
                    NASA_TLX_DIMENSIONS.length,
                  )}
                </p>
                <h1 className="flow-title">{dimensionText.label}</h1>
                <p className="flow-sub">{dimensionText.ratingQuestion}</p>
                <div className="slider-card">
                  <output className="slider-value" htmlFor="rating-slider">
                    {rating === null ? '–' : rating}
                  </output>
                  <input
                    id="rating-slider"
                    type="range"
                    min={0}
                    max={100}
                    step={5}
                    value={rating ?? RATING_START}
                    aria-label={dimensionText.label}
                    onChange={(event) => setRating(Number(event.target.value))}
                    onPointerDown={() => {
                      if (rating === null) {
                        setRating(RATING_START);
                      }
                    }}
                    onKeyDown={() => {
                      if (rating === null) {
                        setRating(RATING_START);
                      }
                    }}
                  />
                  <div className="slider-anchors">
                    <span>{t.screening.veryLow}</span>
                    <span>{t.screening.veryHigh}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="button-primary"
                  disabled={rating === null}
                  onClick={goNext}
                >
                  {t.common.continue} <ArrowRightIcon size={18} />
                </button>
                {rating === null && (
                  <p className="flow-note">{t.screening.moveSlider}</p>
                )}
              </>
            );
          })()}

        {step.kind === 'olbiIntro' && (
          <>
            <p className="eyebrow">{t.screening.olbiIntroKicker}</p>
            <h1 className="flow-title">{t.screening.olbiIntroTitle}</h1>
            <p className="flow-sub">
              {t.screening.olbiIntroText(OLBI_STATEMENTS.length)}
            </p>
            <PartStepper current={2} />
            <PartTwoHowTo />
            <button type="button" className="button-primary" onClick={goNext}>
              {t.common.continue} <ArrowRightIcon size={18} />
            </button>
          </>
        )}

        {step.kind === 'olbi' && (
          <>
            <p className="eyebrow">
              {t.screening.olbiKicker(step.index + 1, OLBI_STATEMENTS.length)}
            </p>
            <h1 className="flow-title flow-statement" lang={content.olbiWording}>
              {OLBI_STATEMENTS[step.index][content.olbiWording]}
            </h1>
            <p className="flow-sub">{t.screening.agreeQuestion}</p>
            <div className="option-list" key={`olbi-${step.index}`}>
              {content.olbiOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    answers[step.index] === option.value
                      ? 'option selected'
                      : 'option'
                  }
                  aria-pressed={answers[step.index] === option.value}
                  onClick={() =>
                    chooseAndAdvance(() =>
                      setAnswers((current) =>
                        replaceAt(current, step.index, option.value),
                      ),
                    )
                  }
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step.kind === 'review' && (
          <>
            <p className="eyebrow">{t.screening.doneKicker}</p>
            <h1 className="flow-title">{t.screening.doneTitle}</h1>
            <p className="flow-sub">{t.screening.doneText(advisorName)}</p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button
              type="button"
              className="button-primary"
              onClick={handleSubmit}
            >
              {t.screening.seeResult} <ArrowRightIcon size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
