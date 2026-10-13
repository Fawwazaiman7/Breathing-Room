import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMyAdvisor } from '../advising/useMyAdvisor';
import { ArrowLeftIcon, ArrowRightIcon } from '../components/Icons';
import { LinkAdvisorCard } from '../components/LinkAdvisorCard';
import { ApiError, submitScreening } from '../lib/api';
import {
  DIMENSION_CONTENT,
  NASA_TLX_DIMENSIONS,
  NASA_TLX_PAIRS,
  OLBI_LANGUAGE,
  OLBI_OPTIONS,
  OLBI_STATEMENTS,
} from '../screening/content';
import type { NasaTlxDimension, ScreeningPayload } from '../screening/types';

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
  return (
    <div className="flow-progress">
      <div className="flow-progress-labels">
        <span>{label}</span>
        <span>
          {position} of {total}
        </span>
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
  const { state, setAdvisor } = useMyAdvisor();

  if (state.status === 'loading') {
    return <p className="page-message">Loading…</p>;
  }
  if (state.status === 'error') {
    return (
      <p className="page-message">
        We could not check your Academic Advisor. Please refresh the page.
      </p>
    );
  }
  if (!state.advisor) {
    return (
      <div className="page page-narrow">
        <LinkAdvisorCard onLinked={setAdvisor} />
      </div>
    );
  }
  return (
    <ScreeningFlow advisorName={state.advisor.fullName || 'your advisor'} />
  );
}

function ScreeningFlow({ advisorName }: { advisorName: string }) {
  const navigate = useNavigate();
  const [stepIndex, setStepIndex] = useState(0);
  const [choices, setChoices] = useState<(NasaTlxDimension | null)[]>(() =>
    NASA_TLX_PAIRS.map(() => null),
  );
  const [ratings, setRatings] = useState<(number | null)[]>(() =>
    NASA_TLX_DIMENSIONS.map(() => null),
  );
  const [answers, setAnswers] = useState<(number | null)[]>(() =>
    OLBI_STATEMENTS.map(() => null),
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const step = STEPS[stepIndex];

  function goNext() {
    setStepIndex((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function goBack() {
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
      setError('Some answers are missing. Please go back and complete them.');
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
      navigate(`/app/results/${result.id}`, { state: { result } });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Something went wrong. Please try again.',
      );
      setSubmitting(false);
    }
  }

  if (submitting) {
    return (
      <div className="flow">
        <div className="flow-body flow-center" role="status">
          <span className="spinner" aria-hidden="true" />
          <h1 className="flow-title">Putting your result together…</h1>
          <p className="flow-sub">This only takes a moment.</p>
        </div>
      </div>
    );
  }

  let progress: { label: string; position: number; total: number } | null =
    null;
  if (step.kind === 'compare') {
    progress = {
      label: 'Academic workload · NASA-TLX',
      position: step.index + 1,
      total: PART_ONE_TOTAL,
    };
  } else if (step.kind === 'rate') {
    progress = {
      label: 'Academic workload · NASA-TLX',
      position: NASA_TLX_PAIRS.length + step.index + 1,
      total: PART_ONE_TOTAL,
    };
  } else if (step.kind === 'olbi') {
    progress = {
      label: 'How you have been feeling · OLBI',
      position: step.index + 1,
      total: PART_TWO_TOTAL,
    };
  }

  return (
    <div className="flow">
      <button type="button" className="back-button" onClick={goBack}>
        <ArrowLeftIcon size={18} /> Back
      </button>

      {progress && <Progress {...progress} />}

      <div className="flow-body">
        {step.kind === 'intro' && (
          <>
            <p className="eyebrow">Screening</p>
            <h1 className="flow-title">A quick check-in, in two parts</h1>
            <p className="flow-sub">
              Part 1 looks at your academic workload. Part 2 asks how you have
              been feeling about your studies. It takes around 8–10 minutes.
            </p>
            <ul className="plain-list">
              <li>Answer based on the past two weeks.</li>
              <li>There are no right or wrong answers.</li>
              <li>
                Your result is shown to you and shared with your Academic
                Advisor, {advisorName}, so they can offer support.
              </li>
            </ul>
            <button type="button" className="button-primary" onClick={goNext}>
              Start <ArrowRightIcon size={18} />
            </button>
          </>
        )}

        {step.kind === 'compare' && (
          <>
            <p className="eyebrow">
              Part 1 of 2 · Comparison {step.index + 1} of{' '}
              {NASA_TLX_PAIRS.length}
            </p>
            <h1 className="flow-title">
              Which one contributed more to your workload?
            </h1>
            <p className="flow-sub">
              Think about your academic work over the past two weeks. Choose
              the experience that had the greater impact.
            </p>
            <div className="choice-pair">
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
                  onClick={() => {
                    setChoices((current) =>
                      replaceAt(current, step.index, dimension),
                    );
                    goNext();
                  }}
                >
                  <span className="choice-letter">
                    {optionIndex === 0 ? 'A' : 'B'}
                  </span>
                  <span className="choice-label">
                    {DIMENSION_CONTENT[dimension].label}
                  </span>
                  <span className="choice-description">
                    {DIMENSION_CONTENT[dimension].description}
                  </span>
                </button>
              ))}
            </div>
            <p className="flow-note">
              Take your time. There is no right or wrong choice.
            </p>
          </>
        )}

        {step.kind === 'rate' &&
          (() => {
            const dimension = NASA_TLX_DIMENSIONS[step.index];
            const content = DIMENSION_CONTENT[dimension];
            const rating = ratings[step.index];
            const setRating = (value: number) =>
              setRatings((current) => replaceAt(current, step.index, value));
            return (
              <>
                <p className="eyebrow">
                  Part 1 of 2 · Rating {step.index + 1} of{' '}
                  {NASA_TLX_DIMENSIONS.length}
                </p>
                <h1 className="flow-title">{content.label}</h1>
                <p className="flow-sub">{content.ratingQuestion}</p>
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
                    aria-label={content.label}
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
                    <span>Very low</span>
                    <span>Very high</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="button-primary"
                  disabled={rating === null}
                  onClick={goNext}
                >
                  Continue <ArrowRightIcon size={18} />
                </button>
                {rating === null && (
                  <p className="flow-note">Move the slider to answer.</p>
                )}
              </>
            );
          })()}

        {step.kind === 'olbiIntro' && (
          <>
            <p className="eyebrow">Part 2 of 2</p>
            <h1 className="flow-title">How you have been feeling</h1>
            <p className="flow-sub">
              Next are {OLBI_STATEMENTS.length} short statements about your
              studies. For each one, choose how much you agree.
            </p>
            <button type="button" className="button-primary" onClick={goNext}>
              Continue <ArrowRightIcon size={18} />
            </button>
          </>
        )}

        {step.kind === 'olbi' && (
          <>
            <p className="eyebrow">
              Part 2 of 2 · Statement {step.index + 1} of{' '}
              {OLBI_STATEMENTS.length}
            </p>
            <h1 className="flow-title flow-statement">
              {OLBI_STATEMENTS[step.index][OLBI_LANGUAGE]}
            </h1>
            <p className="flow-sub">How much do you agree with this?</p>
            <div className="option-list">
              {OLBI_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={
                    answers[step.index] === option.value
                      ? 'option selected'
                      : 'option'
                  }
                  aria-pressed={answers[step.index] === option.value}
                  onClick={() => {
                    setAnswers((current) =>
                      replaceAt(current, step.index, option.value),
                    );
                    goNext();
                  }}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step.kind === 'review' && (
          <>
            <p className="eyebrow">All done</p>
            <h1 className="flow-title">Thank you for checking in</h1>
            <p className="flow-sub">
              Submit your answers to see your result. It will also be shared
              with your Academic Advisor, {advisorName}.
            </p>
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
              See my result <ArrowRightIcon size={18} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
