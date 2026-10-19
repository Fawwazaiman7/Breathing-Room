import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRightIcon } from '../components/Icons';
import { RiskBadge } from '../components/RiskBadge';
import { useScreeningContent } from '../i18n/screening-content';
import { useT } from '../i18n/strings';
import { fetchMyScreenings } from '../lib/api';
import type { ScreeningHistoryItem } from '../screening/types';
import type { ChatReplyKind } from './api';

/* -------------------------------------------------------------------------
 * Reply text: short paragraphs and key points
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

export function ReplyBody({ text }: { text: string }) {
  return (
    <>
      {parseReply(text).map((block, index) =>
        block.type === 'paragraph' ? (
          <p key={index} className="reply-paragraph">
            {withLinks(block.text)}
          </p>
        ) : block.ordered ? (
          <ol key={index} className="reply-points reply-steps">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <span className="reply-step-number" aria-hidden="true">
                  {itemIndex + 1}
                </span>
                <span>{pointText(item)}</span>
              </li>
            ))}
          </ol>
        ) : (
          <ul key={index} className="reply-points">
            {block.items.map((item, itemIndex) => (
              <li key={itemIndex}>
                <span className="reply-point-mark" aria-hidden="true" />
                <span>{pointText(item)}</span>
              </li>
            ))}
          </ul>
        ),
      )}
    </>
  );
}

/* -------------------------------------------------------------------------
 * Small pictures under a reply
 * ---------------------------------------------------------------------- */

export type ReplyVisualKind = 'signs' | 'path' | 'result';

/**
 * Which picture, if any, goes under a reply. "signs" and "path" explain a
 * topic, so they appear once per conversation; the result card appears
 * whenever the student's result is the topic.
 */
export function visualFor(
  kind: ChatReplyKind,
  intent: string | null,
  alreadyShown: Set<ReplyVisualKind | null | undefined>,
): ReplyVisualKind | null {
  if (kind !== 'answer' && kind !== 'fallback') {
    return null;
  }
  if (intent === 'SCREENING_RESULT') {
    return 'result';
  }
  const once = (visual: ReplyVisualKind) =>
    alreadyShown.has(visual) ? null : visual;
  if (intent === 'BURNOUT_INFO' || intent === 'EXHAUSTION_DISENGAGEMENT') {
    return once('signs');
  }
  if (intent === 'STUDENT_SUPPORT') {
    return once('path');
  }
  return null;
}

export function ReplyVisual({ kind }: { kind: ReplyVisualKind }) {
  if (kind === 'signs') {
    return <BurnoutSigns />;
  }
  if (kind === 'path') {
    return <SupportPath />;
  }
  return <LatestResult />;
}

/** Exhaustion and disengagement, with workload as the pressure behind them. */
function BurnoutSigns() {
  const t = useT();
  return (
    <figure className="reply-visual">
      <figcaption>{t.chat.signsTitle}</figcaption>
      <div className="signs-grid">
        {t.chat.signs.map((sign, index) => (
          <div key={sign.label} className={`sign-tile sign-${index}`}>
            <strong>{sign.label}</strong>
            <span>{sign.text}</span>
          </div>
        ))}
      </div>
    </figure>
  );
}

/** The three steps of support, from looking after yourself to counselling. */
function SupportPath() {
  const t = useT();
  return (
    <figure className="reply-visual">
      <figcaption>{t.chat.pathTitle}</figcaption>
      <ol className="support-path">
        {t.chat.path.map((step, index) => (
          <li key={step.label}>
            <span className="support-path-number" aria-hidden="true">
              {index + 1}
            </span>
            <span className="support-path-text">
              <strong>{step.label}</strong>
              <span>{step.text}</span>
            </span>
          </li>
        ))}
      </ol>
    </figure>
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
      <RiskBadge category={item.category} />
      <dl className="result-meters">
        {rows.map((row) => (
          <div key={row.label} className="result-meter">
            <dt>{row.label}</dt>
            <dd>
              <span className="meter" aria-hidden="true">
                {Array.from({ length: row.total }, (_, index) => (
                  <span
                    key={index}
                    className={index < row.filled ? 'meter-step on' : 'meter-step'}
                  />
                ))}
              </span>
              <span className="meter-value">{row.value}</span>
            </dd>
          </div>
        ))}
      </dl>
      <Link className="text-link" to={`/app/results/${item.id}`}>
        {t.chat.seeResult} <ArrowRightIcon size={16} />
      </Link>
    </figure>
  );
}
