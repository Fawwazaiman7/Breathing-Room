import { useEffect, useRef, useState } from 'react';
import { localeOf, useLanguage } from '../i18n/language';
import { useScreeningContent } from '../i18n/screening-content';
import { useT } from '../i18n/strings';
import type { ScreeningCategory, ScreeningHistoryItem } from '../screening/types';
import { TrendIcon } from './Icons';

/** Rows from bottom to top: lower burnout risk sits lower on the chart. */
const LEVELS: ScreeningCategory[] = [
  'NO_BURNOUT',
  'LOW_RISK',
  'MODERATE_RISK',
  'HIGH_RISK',
];

/** At most this many screenings are drawn; older ones stay in the list. */
const MAX_POINTS = 8;

// Drawing area in CSS pixels. The chart is drawn at the width of its card,
// so the text keeps its real size on a phone as on a laptop.
const HEIGHT = 230;
const RIGHT = 16;
const TOP = 34;
const BOTTOM = 40;

/**
 * Burnout screening category over time, one dot per screening.
 *
 * The category is ordinal, so position carries it (one row per category,
 * named on the left) and a single teal line joins the dots. Colour is not
 * needed to read it. Each dot shows its date and category on hover or
 * keyboard focus, and a table of the same data is there for screen readers.
 */
export function TrendChart({ items }: { items: ScreeningHistoryItem[] }) {
  const t = useT();
  const { language } = useLanguage();
  const content = useScreeningContent();
  const [active, setActive] = useState<number | null>(null);
  const plotRef = useRef<HTMLDivElement | null>(null);
  const [WIDTH, setWidth] = useState(640);

  useEffect(() => {
    const element = plotRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setWidth(Math.max(240, Math.round(entry.contentRect.width)));
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  // A narrower label column on a phone.
  const LEFT = WIDTH < 420 ? 92 : 112;

  // Oldest first, newest on the right.
  const points = [...items]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .slice(-MAX_POINTS);

  const dateShort = new Intl.DateTimeFormat(localeOf(language), {
    day: 'numeric',
    month: 'short',
  });
  const dateLong = new Intl.DateTimeFormat(localeOf(language), {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  if (points.length < 2) {
    return (
      <section className="card trend-card">
        <p className="eyebrow">{t.trend.kicker}</p>
        <h2 className="card-title">{t.trend.title}</h2>
        <p className="trend-empty">
          <TrendIcon size={20} /> {t.trend.one}
        </p>
      </section>
    );
  }

  const plotWidth = WIDTH - LEFT - RIGHT;
  const plotHeight = HEIGHT - TOP - BOTTOM;
  const rowY = (category: ScreeningCategory) =>
    TOP + plotHeight - (LEVELS.indexOf(category) / (LEVELS.length - 1)) * plotHeight;
  const x = (index: number) =>
    LEFT + (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth);

  const latest = points[points.length - 1];
  const previous = points[points.length - 2];
  const change =
    LEVELS.indexOf(latest.category) - LEVELS.indexOf(previous.category);
  const summary =
    change < 0 ? t.trend.better : change > 0 ? t.trend.worse : t.trend.same;

  const path = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${x(index)},${rowY(point.category)}`)
    .join(' ');

  const shown = active === null ? null : points[active];

  return (
    <section className="card trend-card">
      <p className="eyebrow">{t.trend.kicker}</p>
      <h2 className="card-title">{t.trend.title}</h2>
      <p className="card-text">{summary}</p>

      <div className="trend-plot" ref={plotRef}>
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={t.trend.chartLabel(points.length)}
        >
          <text className="trend-axis-title" x={8} y={14}>
            {t.trend.axis}
          </text>
          {LEVELS.map((level, levelIndex) => (
            <g key={level}>
              <line
                className="trend-grid"
                x1={LEFT - 12}
                x2={WIDTH - RIGHT + 8}
                y1={rowY(level)}
                y2={rowY(level)}
              />
              <text
                className="trend-axis"
                x={LEFT - 20}
                y={rowY(level)}
                textAnchor="end"
                dominantBaseline="middle"
              >
                {t.trend.levels[levelIndex]}
              </text>
            </g>
          ))}

          <path className="trend-line" d={path} />

          {points.map((point, index) => (
            <text
              key={`d-${point.id}`}
              className="trend-axis"
              x={x(index)}
              y={HEIGHT - 12}
              textAnchor={
                index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'
              }
            >
              {dateShort.format(new Date(point.createdAt))}
            </text>
          ))}

          {points.map((point, index) => (
            <g
              key={point.id}
              className={index === active ? 'trend-point active' : 'trend-point'}
              tabIndex={0}
              role="img"
              aria-label={`${dateLong.format(new Date(point.createdAt))}: ${content.categories[point.category].label}`}
              onMouseEnter={() => setActive(index)}
              onMouseLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
            >
              {/* A larger invisible target than the dot itself. */}
              <circle className="trend-hit" cx={x(index)} cy={rowY(point.category)} r={18} />
              <circle
                className={index === points.length - 1 ? 'trend-dot latest' : 'trend-dot'}
                cx={x(index)}
                cy={rowY(point.category)}
                r={index === points.length - 1 ? 7 : 5.5}
              />
            </g>
          ))}
        </svg>

        {shown && active !== null && (
          <div
            className="trend-tip"
            style={{
              left: `${(x(active) / WIDTH) * 100}%`,
              top: `${(rowY(shown.category) / HEIGHT) * 100}%`,
            }}
            aria-hidden="true"
          >
            <strong>{content.categories[shown.category].label}</strong>
            <span>{dateLong.format(new Date(shown.createdAt))}</span>
          </div>
        )}
      </div>

      {items.length > points.length && (
        <p className="fine-print">{t.trend.showing(points.length, items.length)}</p>
      )}

      {/* Wrapped, because a table does not shrink to 1px on its own. */}
      <div className="visually-hidden">
      <table>
        <caption>{t.trend.title}</caption>
        <tbody>
          {points.map((point) => (
            <tr key={point.id}>
              <th scope="row">{dateLong.format(new Date(point.createdAt))}</th>
              <td>{content.categories[point.category].label}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>
    </section>
  );
}
