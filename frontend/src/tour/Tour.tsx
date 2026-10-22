import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import type { CSSProperties, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CloseIcon, LeafIcon } from '../components/Icons';
import { useT } from '../i18n/strings';
import type { Strings } from '../i18n/strings';
import { setDrawer } from '../components/Drawer';
import './tour.css';

/*
 * A step-by-step guide over the student workspace, like the tutorial at
 * the start of a game: the screen dims, one part of it is lit up, and a
 * card says what it is for. It opens by itself on the first visit after
 * sign-in, and from the "App guide" button at any time.
 */

type StepKey = keyof Strings['tour']['steps'];

/** Each step lights up the element marked data-tour="<key>". */
const STEP_KEYS: StepKey[] = [
  'overview',
  'screening',
  'chat',
  'language',
  'sound',
  'advisor',
  'account',
  'guide',
];

const DONE_PREFIX = 'ruang-pulih:tour-done:';

function isDone(userId: string): boolean {
  try {
    return window.localStorage.getItem(DONE_PREFIX + userId) === '1';
  } catch {
    // Without storage the guide would open on every visit; treat it as seen.
    return true;
  }
}

function markDone(userId: string) {
  try {
    window.localStorage.setItem(DONE_PREFIX + userId, '1');
  } catch {
    // Nothing more to do.
  }
}

interface TourState {
  start: () => void;
}

const TourContext = createContext<TourState>({ start: () => undefined });

export function useTour(): TourState {
  return useContext(TourContext);
}

/** The visible stage: 'welcome', one of the steps, or 'done'. */
type Stage = { kind: 'welcome' } | { kind: 'step'; index: number } | { kind: 'done' };

export function TourProvider({
  userId,
  autoStart,
  children,
}: {
  userId: string | null;
  /** True on the page where the guide may open by itself (the overview). */
  autoStart: boolean;
  children: ReactNode;
}) {
  const [stage, setStage] = useState<Stage | null>(null);

  // First visit after sign-in: open once, after the page has drawn.
  useEffect(() => {
    if (!userId || !autoStart || isDone(userId)) {
      return;
    }
    const timer = window.setTimeout(() => setStage({ kind: 'welcome' }), 500);
    return () => window.clearTimeout(timer);
  }, [userId, autoStart]);

  const start = useCallback(() => setStage({ kind: 'welcome' }), []);
  const value = useMemo(() => ({ start }), [start]);

  const close = useCallback(() => {
    if (userId) {
      markDone(userId);
    }
    setDrawer(false);
    setStage(null);
  }, [userId]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {stage && <TourOverlay stage={stage} setStage={setStage} close={close} />}
    </TourContext.Provider>
  );
}

/**
 * The element a step lights up. The same key can mark two elements (the
 * sound button sits in the sidebar on a laptop and in the top bar on a
 * phone); the one that is shown wins.
 */
function targetOf(key: string): HTMLElement | null {
  const all = document.querySelectorAll<HTMLElement>(`[data-tour="${key}"]`);
  for (const element of all) {
    if (element.getClientRects().length > 0) {
      return element;
    }
  }
  return null;
}

/** Steps whose element is on this page; the others are left out. */
function presentSteps(): StepKey[] {
  return STEP_KEYS.filter((key) => targetOf(key) !== null);
}

interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

function TourOverlay({
  stage,
  setStage,
  close,
}: {
  stage: Stage;
  setStage: (stage: Stage) => void;
  close: () => void;
}) {
  const t = useT();
  const navigate = useNavigate();
  const [steps] = useState(presentSteps);
  const [box, setBox] = useState<Box | null>(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 900);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const stepKey = stage.kind === 'step' ? steps[stage.index] : null;

  // Find the lit-up element, scroll it into view, and follow it on resize.
  useLayoutEffect(() => {
    if (!stepKey) {
      setBox(null);
      return;
    }
    const element = targetOf(stepKey);
    if (!element) {
      setBox(null);
      return;
    }
    // On a phone the sidebar is a drawer: open it for the steps inside it.
    const inDrawer =
      window.innerWidth <= 900 && element.closest('.sidebar') !== null;
    setDrawer(inDrawer);
    if (!inDrawer) {
      element.scrollIntoView({ block: 'center', behavior: 'auto' });
    }
    const measure = () => {
      const rect = element.getBoundingClientRect();
      setBox({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
      setNarrow(window.innerWidth <= 900);
    };
    measure();
    // Measure again once the drawer has slid in.
    const settle = window.setTimeout(measure, 320);
    window.addEventListener('resize', measure);
    window.addEventListener('scroll', measure, true);
    return () => {
      window.clearTimeout(settle);
      window.removeEventListener('resize', measure);
      window.removeEventListener('scroll', measure, true);
    };
  }, [stepKey]);

  // Leaving the steps closes the drawer the guide opened.
  useEffect(() => {
    if (stage.kind !== 'step') {
      setDrawer(false);
    }
  }, [stage.kind]);

  // Keyboard: Esc closes, arrows move. One listener for the guide's whole
  // life, reading the latest step through a ref, and in the capture phase
  // so it runs before the drawer's own Escape handling.
  const keysRef = useRef({ close, goNext: () => {}, goBack: () => {} });
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        keysRef.current.close();
      } else if (event.key === 'ArrowRight') {
        keysRef.current.goNext();
      } else if (event.key === 'ArrowLeft') {
        keysRef.current.goBack();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  useEffect(() => {
    primaryRef.current?.focus();
  }, [stage]);

  function goNext() {
    if (stage.kind === 'welcome') {
      setStage(steps.length > 0 ? { kind: 'step', index: 0 } : { kind: 'done' });
    } else if (stage.kind === 'step') {
      setStage(
        stage.index + 1 < steps.length
          ? { kind: 'step', index: stage.index + 1 }
          : { kind: 'done' },
      );
    }
  }

  function goBack() {
    if (stage.kind === 'step') {
      setStage(stage.index > 0 ? { kind: 'step', index: stage.index - 1 } : { kind: 'welcome' });
    } else if (stage.kind === 'done' && steps.length > 0) {
      setStage({ kind: 'step', index: steps.length - 1 });
    }
  }

  keysRef.current = { close, goNext, goBack };

  const total = steps.length;
  const PAD = 8;

  // Where the card goes: beside the lit-up part on a wide screen, as a
  // sheet at the bottom on a phone, in the middle for welcome and done.
  let cardStyle: CSSProperties | undefined;
  let cardClass = 'tour-card';
  if (stage.kind !== 'step' || !box) {
    cardClass += ' tour-card-center';
  } else if (narrow) {
    cardClass += ' tour-card-sheet';
  } else {
    const width = 340;
    const roomRight = window.innerWidth - (box.left + box.width);
    const left =
      roomRight > width + 40
        ? box.left + box.width + 20
        : Math.max(16, Math.min(box.left, window.innerWidth - width - 16));
    const below = roomRight > width + 40 ? box.top : box.top + box.height + 16;
    const top = Math.max(16, Math.min(below, window.innerHeight - 260));
    cardStyle = { top, left, width };
  }

  const progress =
    stage.kind === 'welcome' ? 0 : stage.kind === 'done' ? 1 : (stage.index + 1) / (total + 1);

  return (
    <div className="tour" role="presentation">
      {/* The dimmed screen, with a lit-up window over the current element. */}
      {box && stage.kind === 'step' ? (
        <div
          className="tour-spot"
          style={{
            top: box.top - PAD,
            left: box.left - PAD,
            width: box.width + PAD * 2,
            height: box.height + PAD * 2,
          }}
          aria-hidden="true"
        />
      ) : (
        <div className="tour-dim" aria-hidden="true" />
      )}

      <div
        className={cardClass}
        style={cardStyle}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
      >
        <div className="tour-progress" aria-hidden="true">
          <span style={{ width: `${Math.round(progress * 100)}%` }} />
        </div>
        <button type="button" className="tour-close" onClick={close} aria-label={t.tour.close}>
          <CloseIcon size={18} />
        </button>

        {stage.kind === 'welcome' && (
          <>
            <div className="tour-hero" aria-hidden="true">
              <span className="tour-hero-ring" />
              <span className="tour-hero-mark">
                <LeafIcon size={30} />
              </span>
            </div>
            <p className="eyebrow">{t.tour.welcomeKicker}</p>
            <h2 id="tour-title" className="tour-title">
              {t.tour.welcomeTitle}
            </h2>
            <p className="tour-text">{t.tour.welcomeText}</p>
            <div className="tour-actions">
              <button type="button" className="link-button tour-skip" onClick={close}>
                {t.tour.later}
              </button>
              <button
                ref={primaryRef}
                type="button"
                className="button-primary tour-next"
                onClick={goNext}
              >
                {t.tour.startTour} <ArrowRightIcon size={16} />
              </button>
            </div>
          </>
        )}

        {stage.kind === 'step' && stepKey && (
          <>
            <p className="tour-count">{t.tour.stepOf(stage.index + 1, total)}</p>
            <h2 id="tour-title" className="tour-title">
              {t.tour.steps[stepKey].title}
            </h2>
            <p className="tour-text">{t.tour.steps[stepKey].text}</p>
            <ol className="tour-dots" aria-hidden="true">
              {steps.map((key, index) => (
                <li
                  key={key}
                  className={
                    index === stage.index ? 'on' : index < stage.index ? 'seen' : ''
                  }
                />
              ))}
            </ol>
            <div className="tour-actions">
              <button type="button" className="link-button tour-skip" onClick={close}>
                {t.tour.skip}
              </button>
              <span className="tour-nav">
                <button type="button" className="button-secondary tour-back" onClick={goBack}>
                  <ArrowLeftIcon size={16} />
                  <span className="visually-hidden">{t.tour.back}</span>
                </button>
                <button
                  ref={primaryRef}
                  type="button"
                  className="button-primary tour-next"
                  onClick={goNext}
                >
                  {t.tour.next} <ArrowRightIcon size={16} />
                </button>
              </span>
            </div>
          </>
        )}

        {stage.kind === 'done' && (
          <>
            <div className="tour-badge" aria-hidden="true">
              <span className="tour-burst" />
              <span className="tour-badge-mark">
                <CheckIcon size={30} />
              </span>
            </div>
            <p className="eyebrow">{t.tour.doneKicker}</p>
            <h2 id="tour-title" className="tour-title">
              {t.tour.doneTitle}
            </h2>
            <p className="tour-text">{t.tour.doneText}</p>
            <p className="tour-earned">
              <LeafIcon size={16} /> {t.tour.badge}
            </p>
            <div className="tour-actions">
              <button type="button" className="link-button tour-skip" onClick={close}>
                {t.tour.finish}
              </button>
              <button
                ref={primaryRef}
                type="button"
                className="button-primary tour-next"
                onClick={() => {
                  close();
                  navigate('/app/screening');
                }}
              >
                {t.tour.startScreening} <ArrowRightIcon size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
