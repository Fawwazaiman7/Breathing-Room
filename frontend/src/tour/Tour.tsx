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
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon, CloseIcon, CompassIcon, LeafIcon } from '../components/Icons';
import { useT } from '../i18n/strings';
import type { Strings } from '../i18n/strings';
import { setDrawer } from '../components/Drawer';
import './tour.css';

/*
 * A step-by-step guide over the student or advisor workspace, like the tutorial at
 * the start of a game: the screen dims, one part of it is lit up, and a
 * card says what it is for. It opens by itself on the first visit after
 * sign-in, and from the "App guide" button at any time.
 */

export type TourVariant = 'student' | 'advisor';

type StudentKey = keyof Strings['tour']['steps'];
type AdvisorKey = keyof Strings['advisorTour']['steps'];
type StepKey = StudentKey | AdvisorKey;

/** Each step lights up the element marked data-tour="<key>". */
const STEP_KEYS: Record<TourVariant, StepKey[]> = {
  student: ['overview', 'screening', 'chat', 'language', 'sound', 'advisor', 'account', 'guide'],
  advisor: ['students', 'invite', 'summary', 'insights', 'list', 'account', 'guide'],
};

/** Card size and spacing on a wide screen. */
const CARD_WIDTH = 340;
const CARD_GAP = 16;
const EDGE = 16;

const DONE_PREFIX: Record<TourVariant, string> = {
  student: 'ruang-pulih:tour-done:',
  advisor: 'ruang-pulih:advisor-tour-done:',
};

/** The words for one variant: welcome, steps and the closing card. */
function wordsFor(t: Strings, variant: TourVariant) {
  if (variant === 'advisor') {
    const a = t.advisorTour;
    return {
      welcomeTitle: a.welcomeTitle,
      welcomeText: a.welcomeText,
      steps: a.steps as Record<string, { title: string; text: string }>,
      doneText: a.doneText,
      badge: a.badge,
      cta: a.showCode,
    };
  }
  return {
    welcomeTitle: t.tour.welcomeTitle,
    welcomeText: t.tour.welcomeText,
    steps: t.tour.steps as Record<string, { title: string; text: string }>,
    doneText: t.tour.doneText,
    badge: t.tour.badge,
    cta: t.tour.startScreening,
  };
}

function isDone(variant: TourVariant, userId: string): boolean {
  try {
    return window.localStorage.getItem(DONE_PREFIX[variant] + userId) === '1';
  } catch {
    // Without storage the guide would open on every visit; treat it as seen.
    return true;
  }
}

function markDone(variant: TourVariant, userId: string) {
  try {
    window.localStorage.setItem(DONE_PREFIX[variant] + userId, '1');
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

/** Opens the app guide again (sidebar button in both workspaces). */
export function GuideButton() {
  const t = useT();
  const { start } = useTour();
  return (
    <button type="button" className="guide-button" data-tour="guide" onClick={start}>
      <CompassIcon size={18} /> {t.tour.open}
    </button>
  );
}

/** The visible stage: 'welcome', one of the steps, or 'done'. */
type Stage = { kind: 'welcome' } | { kind: 'step'; index: number } | { kind: 'done' };

export function TourProvider({
  userId,
  autoStart,
  variant = 'student',
  children,
}: {
  userId: string | null;
  /** True on the page where the guide may open by itself (the overview). */
  autoStart: boolean;
  variant?: TourVariant;
  children: ReactNode;
}) {
  const [stage, setStage] = useState<Stage | null>(null);

  // First visit after sign-in: open once, after the page has drawn.
  useEffect(() => {
    if (!userId || !autoStart || isDone(variant, userId)) {
      return;
    }
    const timer = window.setTimeout(() => setStage({ kind: 'welcome' }), 500);
    return () => window.clearTimeout(timer);
  }, [userId, autoStart, variant]);

  const start = useCallback(() => setStage({ kind: 'welcome' }), []);
  const value = useMemo(() => ({ start }), [start]);

  const close = useCallback(() => {
    if (userId) {
      markDone(variant, userId);
    }
    setDrawer(false);
    setStage(null);
  }, [userId, variant]);

  return (
    <TourContext.Provider value={value}>
      {children}
      {stage && (
        <TourOverlay stage={stage} setStage={setStage} close={close} variant={variant} />
      )}
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
function presentSteps(variant: TourVariant): StepKey[] {
  return STEP_KEYS[variant].filter((key) => targetOf(key) !== null);
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
  variant,
}: {
  stage: Stage;
  setStage: (stage: Stage) => void;
  close: () => void;
  variant: TourVariant;
}) {
  const t = useT();
  const words = wordsFor(t, variant);
  const navigate = useNavigate();
  // Found again when the steps begin, so parts that loaded after the
  // welcome card opened (the advisor's student list) are included.
  const [steps, setSteps] = useState(() => presentSteps(variant));
  const [box, setBox] = useState<Box | null>(null);
  const [narrow, setNarrow] = useState(() => window.innerWidth <= 900);
  const primaryRef = useRef<HTMLButtonElement | null>(null);
  const cardRef = useRef<HTMLDivElement | null>(null);
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
      // A wide part (like the student list) leaves no room beside it, and
      // when centred it may leave too little room above or below as well.
      // Then scroll so the card fits under the part, or else above it.
      const cardHeight = cardRef.current?.offsetHeight ?? 300;
      const fits = () => {
        const rect = element.getBoundingClientRect();
        return (
          rect.bottom + CARD_GAP + cardHeight <= window.innerHeight - EDGE ||
          rect.top - CARD_GAP - cardHeight >= EDGE
        );
      };
      const first = element.getBoundingClientRect();
      const sideRoom = Math.max(window.innerWidth - first.right, first.left);
      if (sideRoom <= CARD_WIDTH + 40 && !fits()) {
        window.scrollBy({ top: first.top - EDGE, behavior: 'auto' });
        if (!fits()) {
          const rect = element.getBoundingClientRect();
          window.scrollBy({ top: rect.top - (EDGE + cardHeight + CARD_GAP), behavior: 'auto' });
        }
      }
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
      const found = presentSteps(variant);
      setSteps(found);
      setStage(found.length > 0 ? { kind: 'step', index: 0 } : { kind: 'done' });
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
    // Beside the lit-up part when there is room; otherwise below it, or
    // above it, so the card never covers what it is pointing at.
    const width = CARD_WIDTH;
    const height = cardRef.current?.offsetHeight ?? 300;
    const W = window.innerWidth;
    const H = window.innerHeight;
    const roomRight = W - (box.left + box.width);
    const clampTop = (value: number) => Math.max(EDGE, Math.min(value, H - height - EDGE));
    let left: number;
    let top: number;
    if (roomRight > width + 40) {
      left = box.left + box.width + 20;
      top = clampTop(box.top);
    } else if (box.left > width + 40) {
      left = box.left - width - 20;
      top = clampTop(box.top);
    } else {
      left = Math.max(EDGE, Math.min(box.left, W - width - EDGE));
      const below = box.top + box.height + CARD_GAP;
      const above = box.top - CARD_GAP - height;
      top = below + height <= H - EDGE ? below : above >= EDGE ? above : clampTop(below);
    }
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
        ref={cardRef}
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
              {words.welcomeTitle}
            </h2>
            <p className="tour-text">{words.welcomeText}</p>
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
              {words.steps[stepKey].title}
            </h2>
            <p className="tour-text">{words.steps[stepKey].text}</p>
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
            <p className="tour-text">{words.doneText}</p>
            <p className="tour-earned">
              <LeafIcon size={16} /> {words.badge}
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
                  if (variant === 'advisor') {
                    showAdvisorCode();
                  } else {
                    navigate('/app/screening');
                  }
                }}
              >
                {words.cta} <ArrowRightIcon size={16} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/** Brings the advisor code card into view and lights it up for a moment. */
function showAdvisorCode() {
  const card = document.querySelector<HTMLElement>('[data-tour="invite"]');
  if (!card) {
    return;
  }
  card.scrollIntoView({ block: 'center', behavior: 'smooth' });
  card.classList.remove('tour-flash');
  // Restart the highlight even if it ran before.
  void card.offsetWidth;
  card.classList.add('tour-flash');
  window.setTimeout(() => card.classList.remove('tour-flash'), 2400);
  card.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true });
}
