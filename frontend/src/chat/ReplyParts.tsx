import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowRightIcon,
  BatteryIcon,
  BookIcon,
  CalendarIcon,
  ClockIcon,
  CoffeeIcon,
  HeartIcon,
  LeafIcon,
  ListIcon,
  MoonIcon,
  PeopleIcon,
  SparkIcon,
  TargetIcon,
  TrendIcon,
} from '../components/Icons';
import { RiskBadge } from '../components/RiskBadge';
import { useScreeningContent } from '../i18n/screening-content';
import { useT } from '../i18n/strings';
import { fetchMyScreenings } from '../lib/api';
import type { ScreeningCategory, ScreeningHistoryItem } from '../screening/types';
import type { ChatReplyKind } from './api';

/*
 * How a Support Chat reply is shown.
 *
 * 1. A topic banner with a small illustration, so the topic is seen at once.
 * 2. The short answer, then the key points as illustrated cards: each point
 *    gets an icon that matches its words (rest, plan, ask for help...).
 *    The layout follows the topic: steps for time management, a two-column
 *    grid for workload and burnout, a list for the rest.
 * 3. One picture that explains the topic (a diagram, a comparison, a cycle,
 *    a gauge). Each picture restates passages from the knowledge base and
 *    adds nothing new. Topic pictures are not repeated in one conversation.
 */

/* -------------------------------------------------------------------------
 * Topic banner
 * ---------------------------------------------------------------------- */

const TOPIC_ART: Record<string, { icon: ReactNode; tone: string }> = {
  BURNOUT_INFO: { icon: <BatteryIcon size={20} />, tone: 'clay' },
  WORKLOAD: { icon: <BookIcon size={20} />, tone: 'sand' },
  EXHAUSTION_DISENGAGEMENT: { icon: <LeafIcon size={20} />, tone: 'sage' },
  TIME_MANAGEMENT: { icon: <ClockIcon size={20} />, tone: 'teal' },
  SCREENING_RESULT: { icon: <TrendIcon size={20} />, tone: 'teal' },
  STUDENT_SUPPORT: { icon: <PeopleIcon size={20} />, tone: 'sage' },
};

export function TopicBanner({ intent }: { intent: string }) {
  const t = useT();
  const art = TOPIC_ART[intent];
  const label = t.chat.intents[intent];
  if (!art || !label) {
    return null;
  }
  return (
    <span className={`chat-topic-chip topic-${art.tone}`}>
      <span className="chat-topic-art" aria-hidden="true">
        {art.icon}
      </span>
      {label}
    </span>
  );
}

/* -------------------------------------------------------------------------
 * Reply text: short paragraphs and illustrated key points
 * ---------------------------------------------------------------------- */

type Block =
  | { type: 'paragraph'; text: string }
  | { type: 'points'; ordered: boolean; items: string[] };

const POINT = /^\s*(?:[-•*]|(\d+)[.)])\s+(.*)$/;

/**
 * Splits a reply into paragraphs and lists. The Support Chat is asked for
 * one short answer sentence and then 2 to 4 points on their own lines
 * ("- " or "1. "). Anything else is shown as plain paragraphs.
 */
export function parseReply(text: string): Block[] {
  const blocks: Block[] = [];
  let paragraph: string[] = [];
  const flush = () => {
    if (paragraph.length > 0) {
      blocks.push({ type: 'paragraph', text: paragraph.join(' ') });
      paragraph = [];
    }
  };
  for (const line of text.split('\n')) {
    const point = POINT.exec(line);
    if (point) {
      flush();
      const ordered = point[1] !== undefined;
      const last = blocks[blocks.length - 1];
      if (last && last.type === 'points' && last.ordered === ordered) {
        last.items.push(point[2].trim());
      } else {
        blocks.push({ type: 'points', ordered, items: [point[2].trim()] });
      }
    } else if (line.trim() === '') {
      flush();
    } else {
      paragraph.push(line.trim());
    }
  }
  flush();
  return blocks;
}

/** Shows web addresses as links; everything else stays plain text. */
function withLinks(text: string): ReactNode[] {
  return text.split(/(https?:\/\/[^\s)]+)/g).map((part, index) => {
    if (!/^https?:\/\//.test(part)) {
      return part;
    }
    const url = part.replace(/[.,;:!?]+$/, '');
    return (
      <span key={index}>
        <a href={url} target="_blank" rel="noopener noreferrer">
          {url}
        </a>
        {part.slice(url.length)}
      </span>
    );
  });
}

/** "Rest: sleep comes first" -> a bold label and its text. */
function pointText(item: string): ReactNode {
  const match = /^([^:]{2,40}):\s+(.+)$/.exec(item);
  if (match && match[1].split(/\s+/).length <= 4) {
    return (
      <>
        <strong>{match[1]}</strong> {withLinks(match[2])}
      </>
    );
  }
  return withLinks(item);
}

/** An icon that matches what a point is about, in English or Indonesian. */
const POINT_ICONS: Array<[RegExp, ReactNode]> = [
  [/\b(sleep|tidur|night|malam)\b/i, <MoonIcon size={18} />],
  // Steps before breaks, so "break it into smaller steps" gets a list.
  [/\b(step|steps|smaller|checkpoint|langkah|kecil|bagian|pecah)\b/i, <ListIcon size={18} />],
  [/\b(break|breaks|pause|istirahat|jeda|rehat|relax|santai)\b/i, <CoffeeIcon size={18} />],
  [/\b(plan|schedule|week|calendar|jadwal|rencana|minggu)\b/i, <CalendarIcon size={18} />],
  [/\b(deadline|deadlines|early|time|waktu|tenggat|awal|mepet)\b/i, <ClockIcon size={18} />],
  [/\b(ask|talk|friend|friends|lecturer|advisor|dpa|counsel\w*|support|help|teman|dosen|bantu\w*|cerita|konsel\w*|dukungan)\b/i, <PeopleIcon size={18} />],
  [/\b(goal|goals|priorit\w*|focus|target|tujuan|fokus)\b/i, <TargetIcon size={18} />],
  [/\b(energy|tired|exhaust\w*|drained|lelah|capek|energi|tenaga|terkuras)\b/i, <BatteryIcon size={18} />],
  [/\b(feel|feeling|emotion\w*|kind|perasaan|rasa|emosi)\b/i, <HeartIcon size={18} />],
];

function iconFor(item: string): ReactNode {
  for (const [pattern, icon] of POINT_ICONS) {
    if (pattern.test(item)) {
      return icon;
    }
  }
  return <SparkIcon size={18} />;
}

/** Points look different per topic, so replies do not all look alike. */
function layoutFor(intent: string | null | undefined, ordered: boolean) {
  if (ordered || intent === 'TIME_MANAGEMENT') {
    return 'steps';
  }
  if (intent === 'WORKLOAD' || intent === 'BURNOUT_INFO') {
    return 'cards';
  }
  return 'list';
}

export function ReplyBody({
  text,
  intent,
}: {
  text: string;
  intent?: string | null;
}) {
  return (
    <>
      {parseReply(text).map((block, index) => {
        if (block.type === 'paragraph') {
          return (
            <p key={index} className="reply-paragraph">
              {withLinks(block.text)}
            </p>
          );
        }
        const layout = layoutFor(intent, block.ordered);
        if (layout === 'steps') {
          return (
            <ol key={index} className="reply-points reply-steps">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex}>
                  <span className="reply-step-number" aria-hidden="true">
                    {itemIndex + 1}
                  </span>
                  <span className="reply-step-text">
                    <span className="reply-point-icon" aria-hidden="true">
                      {iconFor(item)}
                    </span>
                    <span>{pointText(item)}</span>
                  </span>
                </li>
              ))}
            </ol>
          );
        }
        return (
          <ul
            key={index}
            className={
              layout === 'cards' && block.items.length > 1
                ? 'reply-points reply-cards'
                : 'reply-points'
            }
          >
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <span className="reply-point-icon" aria-hidden="true">
                  {iconFor(item)}
                </span>
                <span>{pointText(item)}</span>
              </li>
            ))}
          </ul>
        );
      })}
    </>
  );
}

/* -------------------------------------------------------------------------
 * Which picture goes under a reply
 * ---------------------------------------------------------------------- */

export type ReplyVisualKind =
  | 'result'
  | 'build'
  | 'compare'
  | 'quadrant'
  | 'balance'
  | 'sides'
  | 'loop'
  | 'breakdown'
  | 'path';

const ABOUT_DIFFERENCE =
  /\b(stress|normal|biasa|differen\w*|beda\w*|same|sama|vs)\b/i;
const ABOUT_INSTRUMENT =
  /\b(nasa|tlx|dimension\w*|dimensi|score|skor|side|sisi|demand|tuntutan|questionnaire|kuesioner)\b/i;
const ABOUT_DELAY =
  /\b(procrastinat\w*|put(ting)? off|delay\w*|avoid\w*|nunda|menunda|tunda\w*|males|malas|start|mulai)\b/i;

/**
 * Which picture, if any, goes under a reply. The question decides which
 * picture of the topic fits best; a picture already shown in this
 * conversation gives way to the next one. The result gauge is shown
 * whenever the student's result is the topic.
 */
export function visualFor(
  kind: ChatReplyKind,
  intent: string | null,
  question: string,
  alreadyShown: Set<ReplyVisualKind | null | undefined>,
): ReplyVisualKind | null {
  if (kind !== 'answer' && kind !== 'fallback') {
    return null;
  }
  if (intent === 'SCREENING_RESULT') {
    return 'result';
  }
  let order: ReplyVisualKind[] = [];
  if (intent === 'BURNOUT_INFO') {
    order = ABOUT_DIFFERENCE.test(question)
      ? ['compare', 'build']
      : ['build', 'compare'];
  } else if (intent === 'EXHAUSTION_DISENGAGEMENT') {
    order = ['quadrant', 'build'];
  } else if (intent === 'WORKLOAD') {
    order = ABOUT_INSTRUMENT.test(question)
      ? ['sides', 'balance']
      : ['balance', 'sides'];
  } else if (intent === 'TIME_MANAGEMENT') {
    order = ABOUT_DELAY.test(question)
      ? ['loop', 'breakdown']
      : ['breakdown', 'loop'];
  } else if (intent === 'STUDENT_SUPPORT') {
    order = ['path'];
  }
  return order.find((visual) => !alreadyShown.has(visual)) ?? null;
}

export function ReplyVisual({ kind }: { kind: ReplyVisualKind }) {
  switch (kind) {
    case 'build':
      return <BurnoutBuild />;
    case 'compare':
      return <TiredOrBurnout />;
    case 'quadrant':
      return <SignsQuadrant />;
    case 'balance':
      return <DemandsBalance />;
    case 'sides':
      return <SixSides />;
    case 'loop':
      return <PutOffLoop />;
    case 'breakdown':
      return <BreakItDown />;
    case 'path':
      return <SupportPath />;
    default:
      return <LatestResult />;
  }
}

/* -------------------------------------------------------------------------
 * The pictures
 * ---------------------------------------------------------------------- */

/** BI-01, BI-02: long high demands lead to exhaustion and disengagement. */
function BurnoutBuild() {
  const v = useT().chat.build;
  return (
    <figure className="reply-visual">
      <figcaption>{v.title}</figcaption>
      <div className="build-flow">
        <div className="build-node build-cause">
          <BookIcon size={20} />
          <strong>{v.cause}</strong>
          <span>{v.causeNote}</span>
        </div>
        <span className="build-arrow" aria-hidden="true" />
        <div className="build-signs">
          <div className="build-node">
            <BatteryIcon size={20} />
            <strong>{v.signA}</strong>
            <span>{v.signANote}</span>
          </div>
          <div className="build-node">
            <LeafIcon size={20} />
            <strong>{v.signB}</strong>
            <span>{v.signBNote}</span>
          </div>
        </div>
        <span className="build-arrow" aria-hidden="true" />
        <div className="build-node build-result">
          <strong>{v.result}</strong>
        </div>
      </div>
    </figure>
  );
}

/** BI-04: normal tiredness compared with burnout. */
function TiredOrBurnout() {
  const v = useT().chat.compare;
  return (
    <figure className="reply-visual">
      <figcaption>{v.title}</figcaption>
      <div className="compare-grid">
        <div className="compare-col compare-ok">
          <strong>
            <MoonIcon size={18} /> {v.leftTitle}
          </strong>
          <ul>
            {v.left.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
        <div className="compare-col compare-warn">
          <strong>
            <BatteryIcon size={18} /> {v.rightTitle}
          </strong>
          <ul>
            {v.right.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </div>
      </div>
    </figure>
  );
}

/** ED-05: exhaustion and disengagement can appear apart. */
function SignsQuadrant() {
  const v = useT().chat.quadrant;
  return (
    <figure className="reply-visual">
      <figcaption>{v.title}</figcaption>
      <div className="quadrant">
        <span className="quadrant-y">{v.yAxis}</span>
        <div className="quadrant-grid">
          <span className="quadrant-tick">{v.high}</span>
          <div className="quadrant-cell q-mild">{v.cells.lowHigh}</div>
          <div className="quadrant-cell q-strong">{v.cells.highHigh}</div>
          <span className="quadrant-tick">{v.low}</span>
          <div className="quadrant-cell q-calm">{v.cells.lowLow}</div>
          <div className="quadrant-cell q-mild">{v.cells.highLow}</div>
          <span />
          <span className="quadrant-tick">{v.low}</span>
          <span className="quadrant-tick">{v.high}</span>
        </div>
        <span className="quadrant-x">{v.xAxis}</span>
      </div>
    </figure>
  );
}

/** BI-08, WL-01, WL-07: demands against the resources to meet them. */
function DemandsBalance() {
  const v = useT().chat.balance;
  return (
    <figure className="reply-visual">
      <figcaption>{v.title}</figcaption>
      <div className="balance">
        <svg className="balance-art" viewBox="0 0 240 92" aria-hidden="true">
          <line x1="120" y1="18" x2="120" y2="84" />
          <path d="M96 86h48" />
          {/* The beam tips towards demands. */}
          <line x1="40" y1="34" x2="200" y2="14" />
          <circle cx="120" cy="24" r="4" />
          <path className="balance-pan heavy" d="M14 44h52l-6 12H20Z" />
          <line x1="40" y1="34" x2="22" y2="44" />
          <line x1="40" y1="34" x2="58" y2="44" />
          <path className="balance-pan" d="M174 24h52l-6 12h-40Z" />
          <line x1="200" y1="14" x2="182" y2="24" />
          <line x1="200" y1="14" x2="218" y2="24" />
        </svg>
        <div className="balance-sides">
          <div>
            <strong>{v.demands}</strong>
            <span className="balance-tags">
              {v.demandItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </span>
          </div>
          <div>
            <strong>{v.resources}</strong>
            <span className="balance-tags balance-tags-soft">
              {v.resourceItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </span>
          </div>
        </div>
        <p className="reply-visual-text">{v.note}</p>
      </div>
    </figure>
  );
}

/** WL-02: the six NASA-TLX dimensions. */
function SixSides() {
  const v = useT().chat.sides;
  const icons = [
    <SparkIcon size={18} />,
    <BatteryIcon size={18} />,
    <ClockIcon size={18} />,
    <TargetIcon size={18} />,
    <ListIcon size={18} />,
    <HeartIcon size={18} />,
  ];
  return (
    <figure className="reply-visual">
      <figcaption>{v.title}</figcaption>
      <div className="sides-grid">
        {v.items.map((item, index) => (
          <span key={item} className="side-tile">
            <span aria-hidden="true">{icons[index]}</span>
            {item}
          </span>
        ))}
      </div>
    </figure>
  );
}

/** TM-02: drained, tasks pile up, more pressure, harder to start. */
function PutOffLoop() {
  const v = useT().chat.loop;
  // Four points on a circle, drawn clockwise from the top.
  const spots = [
    { x: 50, y: 6 },
    { x: 94, y: 50 },
    { x: 50, y: 94 },
    { x: 6, y: 50 },
  ];
  return (
    <figure className="reply-visual">
      <figcaption>{v.title}</figcaption>
      <div className="loop">
        <svg className="loop-ring" viewBox="0 0 100 100" aria-hidden="true">
          <circle cx="50" cy="50" r="38" />
          <path d="M83 36l4 7 4-8" />
          <path d="M17 64l-4-7-4 8" />
        </svg>
        <ol className="loop-steps">
          {v.steps.map((step, index) => (
            <li
              key={step}
              style={{ left: `${spots[index].x}%`, top: `${spots[index].y}%` }}
            >
              <span className="loop-number" aria-hidden="true">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </div>
      <p className="reply-visual-text">{v.note}</p>
    </figure>
  );
}

/**
 * TM-04, TM-05: smaller steps with checkpoints; busiest near the end.
 * A track of checkpoints, with bars above it that rise towards the last
 * step, where combining and testing make the load highest.
 */
const BREAKDOWN_LOAD = [34, 46, 58, 100];

function BreakItDown() {
  const v = useT().chat.breakdown;
  const last = v.steps.length - 1;
  return (
    <figure className="reply-visual">
      <figcaption>{v.title}</figcaption>
      <div className="breakdown">
        <ol className="breakdown-track">
          {v.steps.map((step, index) => (
            <li key={step} className={index === last ? 'is-last' : undefined}>
              <span className="breakdown-bar-wrap" aria-hidden="true">
                {index === last && (
                  <span className="breakdown-peak">{v.busiest}</span>
                )}
                <span
                  className="breakdown-bar"
                  style={{ height: `${BREAKDOWN_LOAD[index]}%` }}
                />
              </span>
              <span className="breakdown-dot" aria-hidden="true">
                {index === last ? <TargetIcon size={14} /> : index + 1}
              </span>
              <span className="breakdown-label">{step}</span>
            </li>
          ))}
        </ol>
      </div>
      <p className="reply-visual-text">{v.note}</p>
    </figure>
  );
}

/** The three steps of support, from looking after yourself to counselling. */
function SupportPath() {
  const t = useT();
  const icons = [
    <LeafIcon size={18} />,
    <PeopleIcon size={18} />,
    <HeartIcon size={18} />,
  ];
  return (
    <figure className="reply-visual">
      <figcaption>{t.chat.pathTitle}</figcaption>
      <ol className="support-path">
        {t.chat.path.map((step, index) => (
          <li key={step.label}>
            <span className="support-path-number" aria-hidden="true">
              {icons[index]}
            </span>
            <span className="support-path-text">
              <strong>
                {index + 1}. {step.label}
              </strong>
              <span>{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

const GAUGE_ORDER: ScreeningCategory[] = [
  'NO_BURNOUT',
  'LOW_RISK',
  'MODERATE_RISK',
  'HIGH_RISK',
];

/** A half-circle in four parts, with a needle on the stored category. */
function Gauge({ category }: { category: ScreeningCategory }) {
  const t = useT();
  const index = GAUGE_ORDER.indexOf(category);
  const point = (angle: number, radius: number) => ({
    x: 100 + radius * Math.cos(angle),
    y: 100 - radius * Math.sin(angle),
  });
  // Four arcs from left (180°) to right (0°), with a small gap between.
  const arcs = GAUGE_ORDER.map((_, i) => {
    const from = Math.PI - (i * Math.PI) / 4 - 0.03;
    const to = Math.PI - ((i + 1) * Math.PI) / 4 + 0.03;
    const a = point(from, 80);
    const b = point(to, 80);
    return `M${a.x.toFixed(1)},${a.y.toFixed(1)} A80,80 0 0 1 ${b.x.toFixed(1)},${b.y.toFixed(1)}`;
  });
  const needleAngle = Math.PI - ((index + 0.5) * Math.PI) / 4;
  const tip = point(needleAngle, 62);
  return (
    <div className="gauge">
      <svg viewBox="0 0 200 112" aria-hidden="true">
        {arcs.map((d, i) => (
          <path
            key={d}
            d={d}
            className={`gauge-arc gauge-arc-${i}${i === index ? ' on' : ''}`}
          />
        ))}
        <line
          className="gauge-needle"
          x1="100"
          y1="100"
          x2={tip.x.toFixed(1)}
          y2={tip.y.toFixed(1)}
        />
        <circle className="gauge-hub" cx="100" cy="100" r="6" />
      </svg>
      <ol className="gauge-labels">
        {t.chat.gaugeLevels.map((label, i) => (
          <li key={label} className={i === index ? 'on' : ''}>
            {label}
          </li>
        ))}
      </ol>
    </div>
  );
}

/** The student's latest rule-based result, as stored. Never from the AI. */
function LatestResult() {
  const t = useT();
  const content = useScreeningContent();
  const [state, setState] = useState<
    { status: 'loading' } | { status: 'ready'; item: ScreeningHistoryItem | null }
  >({ status: 'loading' });

  useEffect(() => {
    let active = true;
    fetchMyScreenings()
      .then((list) => {
        if (active) {
          const latest = [...list].sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          )[0];
          setState({ status: 'ready', item: latest ?? null });
        }
      })
      .catch(() => {
        // Without the card the reply still stands on its own.
        if (active) {
          setState({ status: 'ready', item: null });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  if (state.status === 'loading') {
    return null;
  }
  const item = state.item;
  if (!item) {
    return (
      <figure className="reply-visual">
        <figcaption>{t.chat.resultTitle}</figcaption>
        <p className="reply-visual-text">{t.chat.noResult}</p>
        <Link className="text-link" to="/app/screening">
          {t.chat.takeScreening} <ArrowRightIcon size={16} />
        </Link>
      </figure>
    );
  }

  const rows = [
    {
      label: t.result.workload,
      value: content.workloadLabels[item.workload.level],
      filled:
        ['VERY_LOW', 'LOW', 'MODERATE', 'HIGH', 'VERY_HIGH'].indexOf(
          item.workload.level,
        ) + 1,
      total: 5,
    },
    {
      label: t.result.exhaustion,
      value: content.binaryLabels[item.exhaustion.level],
      filled: item.exhaustion.level === 'HIGH' ? 2 : 1,
      total: 2,
    },
    {
      label: t.result.disengagement,
      value: content.binaryLabels[item.disengagement.level],
      filled: item.disengagement.level === 'HIGH' ? 2 : 1,
      total: 2,
    },
  ];

  return (
    <figure className="reply-visual">
      <figcaption>{t.chat.resultTitle}</figcaption>
      <div className="result-visual">
        <div className="result-visual-gauge">
          <Gauge category={item.category} />
          <RiskBadge category={item.category} />
        </div>
        <dl className="result-meters">
          {rows.map((row) => (
            <div key={row.label} className="result-meter">
              <dt>{row.label}</dt>
              <dd>
                <span className="meter" aria-hidden="true">
                  {Array.from({ length: row.total }, (_, index) => (
                    <span
                      key={index}
                      className={
                        index < row.filled ? 'meter-step on' : 'meter-step'
                      }
                    />
                  ))}
                </span>
                <span className="meter-value">{row.value}</span>
              </dd>
            </div>
          ))}
        </dl>
      </div>
      <Link className="text-link" to={`/app/results/${item.id}`}>
        {t.chat.seeResult} <ArrowRightIcon size={16} />
      </Link>
    </figure>
  );
}
