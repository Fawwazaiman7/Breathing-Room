import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
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
import { TrendChart } from '../components/TrendChart';
import { localeOf, useLanguage } from '../i18n/language';
import { useScreeningContent } from '../i18n/screening-content';
import { useT } from '../i18n/strings';
import { fetchMyScreenings } from '../lib/api';
import type { ScreeningHistoryItem } from '../screening/types';
import { usePageTitle } from '../lib/usePageTitle';


const MAX_ITEMS = 5;

export function OverviewPage() {
  const t = useT();
  const { language } = useLanguage();
  const content = useScreeningContent();
  usePageTitle(t.titles.overview);
  const dayFormat = new Intl.DateTimeFormat(localeOf(language), { day: '2-digit' });
  const monthFormat = new Intl.DateTimeFormat(localeOf(language), { month: 'short' });
  // A message handed over by another page, e.g. after a password reset.
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
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
      {notice && (
        <p className="portal-ready" role="status">
          {notice}
        </p>
      )}
      {advisorState.status === 'loading' && (
        <p className="page-message">{t.common.loading}</p>
      )}
      {advisorState.status === 'error' && (
        <section className="card">
          <p className="card-text">
            {t.overview.loadAdvisorFailed}
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
                <span className="dot" /> {t.overview.heroKicker}
              </p>
              <h1 className="hero-title">{t.overview.heroTitle}</h1>
              <p className="hero-text">{t.overview.heroText}</p>
              <Link className="button-light" to="/app/screening">
                {t.overview.start} <ArrowRightIcon size={18} />
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
            <p className="advisor-line" data-tour="advisor">
              <span>
                {t.overview.yourAdvisor}{' '}
                <strong>
                  {advisorState.advisor.fullName || t.common.unnamedAdvisor}
                </strong>
              </span>
              <button
                type="button"
                className="link-button"
                onClick={() => setChanging(true)}
              >
                {t.overview.change}
              </button>
            </p>
          )}
        </>
      )}

      {!failed && items !== null && items.length > 0 && (
        <TrendChart items={items} />
      )}

      <div className="overview-grid">
        <section className="card">
          <p className="eyebrow">{t.overview.checkIns}</p>
          <h2 className="card-title">{t.overview.previous}</h2>

          {failed && (
            <p className="card-text">{t.overview.loadFailed}</p>
          )}
          {!failed && items === null && (
            <p className="card-text">{t.common.loading}</p>
          )}
          {!failed && items !== null && items.length === 0 && (
            <p className="card-text">{t.overview.none}</p>
          )}
          {!failed && items !== null && items.length > 0 && (
            <ul className="history">
              {items.slice(0, MAX_ITEMS).map((item) => {
                const date = new Date(item.createdAt);
                const category = content.categories[item.category];
                return (
                  <li key={item.id}>
                    <Link className="history-row" to={`/app/results/${item.id}`}>
                      <span className="date-chip">
                        <strong>{dayFormat.format(date)}</strong>
                        <span>{monthFormat.format(date)}</span>
                      </span>
                      <span className="history-text">
                        <strong>{category.short}</strong>
                        <span>{t.overview.burnoutScreening}</span>
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
          <p className="eyebrow">{t.overview.chatKicker}</p>
          <h2 className="card-title">{t.overview.chatTitle}</h2>
          <p className="card-text">{t.overview.chatText}</p>
          <Link className="text-link" to="/app/support">
            {t.overview.openChat} <ArrowRightIcon size={18} />
          </Link>
        </section>
      </div>
    </div>
  );
}
