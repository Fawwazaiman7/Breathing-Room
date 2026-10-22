import type { ReactNode } from 'react';
import './howto.css';
import { CheckIcon, ClockIcon } from '../components/Icons';
import { useScreeningContent } from '../i18n/screening-content';
import { useT } from '../i18n/strings';
import { OLBI_STATEMENTS } from './content';

/*
 * Instructions shown before each part of the screening. Each part is
 * explained by a small moving example of the real control (two cards to
 * tap, a slider, an agreement scale), so the student sees what to do
 * before doing it. The examples are decoration only and cannot be clicked.
 */

/** Part 1 and Part 2, with the current one highlighted. */
export function PartStepper({ current }: { current: 1 | 2 }) {
  const t = useT().screening.howTo;
  return (
    <ol className="part-stepper">
      {t.parts.map((part, index) => {
        const number = index + 1;
        const state =
          number === current ? 'on' : number < current ? 'done' : 'next';
        return (
          <li key={part.name} className={`part-step part-${state}`}>
            <span className="part-number" aria-hidden="true">
              {state === 'done' ? <CheckIcon size={14} /> : number}
            </span>
            <span className="part-text">
              <strong>
                {t.partLabel(number)} · {part.name}
              </strong>
              <span>
                <ClockIcon size={13} /> {part.time}
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function HowCard({
  count,
  title,
  text,
  children,
}: {
  count: string;
  title: string;
  text: string;
  children: ReactNode;
}) {
  const t = useT().screening.howTo;
  return (
    <div className="how-card">
      <div className="how-demo" aria-hidden="true">
        <span className="how-demo-label">{t.demoLabel}</span>
        {children}
      </div>
      <span className="how-count">{count}</span>
      <h3 className="how-title">{title}</h3>
      <p className="how-text">{text}</p>
    </div>
  );
}

function Tips({ items }: { items: string[] }) {
  return (
    <ul className="how-tips">
      {items.map((item) => (
        <li key={item}>
          <CheckIcon size={14} /> {item}
        </li>
      ))}
    </ul>
  );
}

/** Before Part 1: the comparisons, then the six ratings. */
export function PartOneHowTo() {
  const t = useT();
  const h = t.screening.howTo;
  return (
    <section className="how-to" aria-label={h.howTitle(1)}>
      <h2 className="how-heading">{h.howTitle(1)}</h2>
      <div className="how-grid">
        <HowCard count={h.compareCount} title={h.compareTitle} text={h.compareText}>
          <div className="demo-pair">
            <span className="demo-choice">{h.compareA}</span>
            <span className="demo-or">{t.screening.or}</span>
            <span className="demo-choice demo-picked">
              {h.compareB}
              <span className="demo-tap" />
            </span>
          </div>
        </HowCard>
        <HowCard count={h.rateCount} title={h.rateTitle} text={h.rateText}>
          <div className="demo-slider">
            <span className="demo-value">70</span>
            <span className="demo-track">
              <span className="demo-fill" />
              <span className="demo-thumb" />
            </span>
            <span className="demo-ends">
              <span>0</span>
              <span>100</span>
            </span>
          </div>
        </HowCard>
      </div>
      <Tips items={h.tips1} />
    </section>
  );
}

/** Before Part 2: one example statement and the agreement scale. */
export function PartTwoHowTo() {
  const t = useT();
  const h = t.screening.howTo;
  const content = useScreeningContent();
  // Statement 12 ("After studying, I usually feel worn out and weary").
  const example = OLBI_STATEMENTS[11][content.olbiWording];
  return (
    <section className="how-to" aria-label={h.howTitle(2)}>
      <h2 className="how-heading">{h.howTitle(2)}</h2>
      <div className="how-grid how-grid-one">
        <HowCard count={h.agreeCount} title={h.agreeTitle} text={h.agreeText}>
          <div className="demo-statement">
            <p>“{example}”</p>
            <div className="demo-scale">
              {content.olbiOptions.map((option) => (
                <span
                  key={option.value}
                  className={option.value === 3 ? 'demo-option demo-picked' : 'demo-option'}
                >
                  {option.label}
                  {option.value === 3 && <span className="demo-tap" />}
                </span>
              ))}
            </div>
          </div>
        </HowCard>
      </div>
      <Tips items={h.tips2} />
    </section>
  );
}
