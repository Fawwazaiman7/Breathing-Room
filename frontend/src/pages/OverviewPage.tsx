import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import '../advising/advising.css';
import { useMyAdvisor } from '../advising/useMyAdvisor';
import {
  ArrowRightIcon,
  ChevronRightIcon,
  LeafIcon,
  MessageIcon,
} from '../components/Icons';
import { LinkAdvisorCard } from '../components/LinkAdvisorCard';
import { RiskBadge } from '../components/RiskBadge';
import { fetchMyScreenings } from '../lib/api';
import { CATEGORY_CONTENT } from '../screening/content';
import type { ScreeningHistoryItem } from '../screening/types';
import { usePageTitle } from '../lib/usePageTitle';

const dayFormat = new Intl.DateTimeFormat('en-GB', { day: '2-digit' });
const monthFormat = new Intl.DateTimeFormat('en-GB', { month: 'short' });

const MAX_ITEMS = 5;

export function OverviewPage() {
  usePageTitle('Overview');
  const [items, setItems] = useState<ScreeningHistoryItem[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { state: advisorState, setAdvisor } = useMyAdvisor();
  const [changing, setChanging] = useState(false);

  useEffect(() => {
    let active = true;
    fetchMyScreenings()
      .then((list) => {
        if (active) {
          setItems(list);
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
  }, []);

  return (
    <div className="page">
      {advisorState.status === 'loading' && (
        <p className="page-message">Loading…</p>
      )}
      {advisorState.status === 'error' && (
        <section className="card">
          <p className="card-text">
            We could not check your Academic Advisor. Please refresh the page.
          </p>
        </section>
      )}
      {advisorState.status === 'ready' && !advisorState.advisor && (
        <LinkAdvisorCard onLinked={setAdvisor} />
      )}
      {advisorState.status === 'ready' && advisorState.advisor && (
        <>
          <section className="hero">
            <div>
              <p className="hero-kicker">
                <span className="dot" /> Burnout check-in available
              </p>
              <h1 className="hero-title">How are things going this semester?</h1>
              <p className="hero-text">
                Your next burnout screening is ready. It takes around 8–10
                minutes and shows your academic workload, your signs of
                burnout, and a suggested next step.
              </p>
              <Link className="button-light" to="/app/screening">
                Start screening <ArrowRightIcon size={18} />
              </Link>
            </div>
            <div className="hero-art" aria-hidden="true">
              <span>
                <LeafIcon size={36} />
              </span>
            </div>
          </section>

          {changing ? (
            <LinkAdvisorCard
              current={advisorState.advisor}
              onLinked={(advisor) => {
                setAdvisor(advisor);
                setChanging(false);
              }}
              onCancel={() => setChanging(false)}
            />
          ) : (
            <p className="advisor-line">
              <span>
                Your Academic Advisor:{' '}
                <strong>{advisorState.advisor.fullName || 'Unnamed advisor'}</strong>
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => setChanging(true)}
              >
                Change
              </button>
            </p>
          )}
        </>
      )}

      <div className="overview-grid">
        <section className="card">
          <p className="eyebrow">Your check-ins</p>
          <h2 className="card-title">Previous burnout screenings</h2>

          {failed && (
            <p className="card-text">
              We could not load your screenings. Please refresh the page.
            </p>
          )}
          {!failed && items === null && <p className="card-text">Loading…</p>}
          {!failed && items !== null && items.length === 0 && (
            <p className="card-text">
              No screenings yet. Your burnout screening results will appear here.
            </p>
          )}
          {!failed && items !== null && items.length > 0 && (
            <ul className="history">
              {items.slice(0, MAX_ITEMS).map((item) => {
                const date = new Date(item.createdAt);
                const content = CATEGORY_CONTENT[item.category];
                return (
                  <li key={item.id}>
                    <Link className="history-row" to={`/app/results/${item.id}`}>
                      <span className="date-chip">
                        <strong>{dayFormat.format(date)}</strong>
                        <span>{monthFormat.format(date)}</span>
                      </span>
                      <span className="history-text">
                        <strong>{content.short}</strong>
                        <span>Burnout screening</span>
                      </span>
                      <RiskBadge category={item.category} />
                      <ChevronRightIcon />
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="card">
          <span className="icon-tile">
            <MessageIcon size={22} />
          </span>
          <p className="eyebrow">Need to talk something through?</p>
          <h2 className="card-title">Support chat</h2>
          <p className="card-text">
            Ask general questions about burnout, workload, or student support
            at any time.
          </p>
          <Link className="text-link" to="/app/support">
            Open Support chat <ArrowRightIcon size={18} />
          </Link>
        </section>
      </div>
    </div>
  );
}
