import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fetchAdvisorDashboard } from '../../advisor/api';
import type { AdviseeListItem, AdvisorDashboard } from '../../advisor/types';
import { ChevronRightIcon } from '../../components/Icons';
import { InviteCodeCard } from '../../components/InviteCodeCard';
import { RiskBadge } from '../../components/RiskBadge';
import {
  BINARY_LABELS,
  CATEGORY_CONTENT,
  WORKLOAD_LABELS,
} from '../../screening/content';
import type { ScreeningCategory } from '../../screening/types';

type Filter = 'ALL' | ScreeningCategory | 'NOT_SCREENED';

/** Most urgent first, matching the order of the student list. */
const CATEGORY_ORDER: ScreeningCategory[] = [
  'HIGH_RISK',
  'MODERATE_RISK',
  'LOW_RISK',
  'NO_BURNOUT',
];

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});

function matches(item: AdviseeListItem, filter: Filter): boolean {
  if (filter === 'ALL') {
    return true;
  }
  if (filter === 'NOT_SCREENED') {
    return item.latest === null;
  }
  return item.latest !== null && item.latest.category === filter;
}

/** A labelled count with a thin bar showing its share of `total`. */
function ShareRow({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const share = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="share-row">
      <span className="share-label">{label}</span>
      <span className="share-track" aria-hidden="true">
        <span className="share-fill" style={{ width: `${share}%` }} />
      </span>
      <span className="share-count">
        {count} <span className="share-percent">({share}%)</span>
      </span>
    </div>
  );
}

export function AdvisorDashboardPage() {
  const [data, setData] = useState<AdvisorDashboard | null>(null);
  const [failed, setFailed] = useState(false);
  const [filter, setFilter] = useState<Filter>('ALL');

  useEffect(() => {
    let active = true;
    fetchAdvisorDashboard()
      .then((result) => {
        if (active) {
          setData(result);
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

  if (failed) {
    return (
      <p className="page-message">
        We could not load your students. Please refresh the page.
      </p>
    );
  }
  if (!data) {
    return <p className="page-message">Loading your students…</p>;
  }

  const { overview, students } = data;
  const screened = overview.screenedStudents;
  const heavyWorkload =
    overview.byWorkload.HIGH + overview.byWorkload.VERY_HIGH;

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: 'ALL', label: 'All', count: overview.totalStudents },
    ...CATEGORY_ORDER.map((category) => ({
      key: category as Filter,
      label: CATEGORY_CONTENT[category].label,
      count: overview.byCategory[category],
    })),
    { key: 'NOT_SCREENED', label: 'Not screened', count: overview.notScreened },
  ];
  const visible = students.filter((item) => matches(item, filter));

  return (
    <div className="page">
      <header>
        <p className="eyebrow">Advisor workspace</p>
        <h1 className="page-title">Your students</h1>
        <p className="card-text">
          The latest screening result for each student you advise. Students
          who may need follow-up are listed first.
        </p>
      </header>

      <InviteCodeCard />

      {overview.totalStudents === 0 ? (
        <section className="card">
          <h2 className="card-title">No students yet</h2>
          <p className="card-text">
            Students appear here after they connect with your advisor code.
          </p>
        </section>
      ) : (
        <>
          <section className="stat-row" aria-label="Summary">
            <div className="stat-tile">
              <span className="stat-label">Students you advise</span>
              <span className="stat-value">{overview.totalStudents}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Have screened</span>
              <span className="stat-value">{screened}</span>
              <span className="stat-note">of {overview.totalStudents}</span>
            </div>
            <div className="stat-tile">
              <span className="stat-label">May need follow-up</span>
              <span className="stat-value">{overview.needsFollowUp}</span>
              <span className="stat-note">Moderate or High risk</span>
            </div>
            <div className="stat-tile">
              <span className="stat-label">Not yet screened</span>
              <span className="stat-value">{overview.notScreened}</span>
            </div>
          </section>

          <div className="advisor-grid">
            <section className="card">
              <p className="eyebrow">Latest result</p>
              <h2 className="card-title">Students by category</h2>
              {screened === 0 ? (
                <p className="card-text">No screenings yet.</p>
              ) : (
                <div className="share-list">
                  {CATEGORY_ORDER.map((category) => (
                    <ShareRow
                      key={category}
                      label={CATEGORY_CONTENT[category].label}
                      count={overview.byCategory[category]}
                      total={screened}
                    />
                  ))}
                </div>
              )}
              <p className="fine-print">
                Share of the {screened} students who have screened.
              </p>
            </section>

            <section className="card">
              <p className="eyebrow">Latest result</p>
              <h2 className="card-title">What students are reporting</h2>
              {screened === 0 ? (
                <p className="card-text">No screenings yet.</p>
              ) : (
                <div className="share-list">
                  <ShareRow
                    label="High or very high workload"
                    count={heavyWorkload}
                    total={screened}
                  />
                  <ShareRow
                    label="High exhaustion"
                    count={overview.highExhaustion}
                    total={screened}
                  />
                  <ShareRow
                    label="High disengagement"
                    count={overview.highDisengagement}
                    total={screened}
                  />
                </div>
              )}
              <p className="fine-print">
                A student can appear in more than one row.
              </p>
            </section>
          </div>

          <section className="card">
            <p className="eyebrow">Student list</p>
            <div className="chip-row" role="group" aria-label="Filter students">
              {filters.map((option) => (
                <button
                  key={option.key}
                  type="button"
                  className={filter === option.key ? 'chip selected' : 'chip'}
                  aria-pressed={filter === option.key}
                  onClick={() => setFilter(option.key)}
                >
                  {option.label} <span className="chip-count">{option.count}</span>
                </button>
              ))}
            </div>

            {visible.length === 0 ? (
              <p className="card-text">No students in this group.</p>
            ) : (
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th scope="col">Student</th>
                      <th scope="col">Latest result</th>
                      <th scope="col">Workload</th>
                      <th scope="col">Exhaustion</th>
                      <th scope="col">Disengagement</th>
                      <th scope="col">Screened on</th>
                      <th scope="col">
                        <span className="visually-hidden">Open</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item) => (
                      <tr key={item.id}>
                        <th scope="row">
                          <Link
                            className="table-link"
                            to={`/advisor/students/${item.id}`}
                          >
                            {item.fullName || 'Unnamed student'}
                          </Link>
                          <span className="table-meta">
                            {[item.studentNumber, item.className]
                              .filter(Boolean)
                              .join(' · ') || 'No student number'}
                          </span>
                        </th>
                        {item.latest ? (
                          <>
                            <td>
                              <RiskBadge category={item.latest.category} />
                            </td>
                            <td>{WORKLOAD_LABELS[item.latest.workload.level]}</td>
                            <td>{BINARY_LABELS[item.latest.exhaustion.level]}</td>
                            <td>
                              {BINARY_LABELS[item.latest.disengagement.level]}
                            </td>
                            <td>
                              {dateFormat.format(new Date(item.latest.createdAt))}
                            </td>
                          </>
                        ) : (
                          <td colSpan={5} className="table-muted">
                            Not screened yet
                          </td>
                        )}
                        <td className="table-action">
                          <Link
                            to={`/advisor/students/${item.id}`}
                            aria-label={`Open ${item.fullName || 'student'}`}
                          >
                            <ChevronRightIcon />
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <p className="fine-print">
            Screening results are not a diagnosis. Categories are determined
            by fixed rules validated by the campus psychologist.
          </p>
        </>
      )}
    </div>
  );
}
