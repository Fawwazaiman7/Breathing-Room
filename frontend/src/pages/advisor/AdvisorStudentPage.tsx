import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import '../../advising/advising.css';
import { removeStudent } from '../../advising/api';
import { fetchAdvisee } from '../../advisor/api';
import type { AdviseeDetail } from '../../advisor/types';
import { ArrowLeftIcon } from '../../components/Icons';
import { RiskBadge } from '../../components/RiskBadge';
import { ApiError } from '../../lib/api';
import {
  BINARY_LABELS,
  CATEGORY_CONTENT,
  WORKLOAD_LABELS,
} from '../../screening/content';

const dateFormat = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export function AdvisorStudentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [removeFailed, setRemoveFailed] = useState(false);

  async function handleRemove() {
    if (!id) {
      return;
    }
    setRemoving(true);
    setRemoveFailed(false);
    try {
      await removeStudent(id);
      navigate('/advisor');
    } catch {
      setRemoveFailed(true);
      setRemoving(false);
    }
  }
  const [loaded, setLoaded] = useState<{
    id: string;
    detail: AdviseeDetail | null;
    notFound: boolean;
  } | null>(null);

  useEffect(() => {
    if (!id) {
      return;
    }
    let active = true;
    fetchAdvisee(id)
      .then((detail) => {
        if (active) {
          setLoaded({ id, detail, notFound: false });
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoaded({
            id,
            detail: null,
            notFound: error instanceof ApiError && error.status === 404,
          });
        }
      });
    return () => {
      active = false;
    };
  }, [id]);

  const backLink = (
    <Link className="back-button" to="/advisor">
      <ArrowLeftIcon size={18} /> All students
    </Link>
  );

  if (!loaded || loaded.id !== id) {
    return <p className="page-message">Loading…</p>;
  }
  if (!loaded.detail) {
    return (
      <div className="page page-narrow">
        {backLink}
        <p className="page-message">
          {loaded.notFound
            ? 'This student is not in your list.'
            : 'We could not load this student. Please try again.'}
        </p>
      </div>
    );
  }

  const { student, latest, latestRule, history } = loaded.detail;
  const meta = [student.studentNumber, student.className]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className="page page-narrow">
      {backLink}

      <header>
        <p className="eyebrow">Student</p>
        <h1 className="page-title">{student.fullName || 'Unnamed student'}</h1>
        {meta && <p className="card-text">{meta}</p>}
      </header>

      {!latest ? (
        <section className="card">
          <h2 className="card-title">Not screened yet</h2>
          <p className="card-text">
            This student has not completed a screening.
          </p>
        </section>
      ) : (
        <>
          {/* The Rule-Based category leads, as on the student's own page. */}
          <section
            className={`result-card result-${CATEGORY_CONTENT[latest.category].tone}`}
          >
            <p className="result-kicker">
              Latest screening · {dateFormat.format(new Date(latest.createdAt))}
            </p>
            <h2 className="result-title">
              {CATEGORY_CONTENT[latest.category].label}
            </h2>
          </section>

          <section className="card">
            <p className="eyebrow">What this is based on</p>
            <div className="metric-row">
              <div className="metric">
                <span className="metric-label">Academic workload</span>
                <span className="metric-value">
                  {WORKLOAD_LABELS[latest.workload.level]}
                </span>
                <span className="metric-note">
                  NASA-TLX score {latest.workload.score} of 100
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Exhaustion</span>
                <span className="metric-value">
                  {BINARY_LABELS[latest.exhaustion.level]}
                </span>
                <span className="metric-note">
                  OLBI mean {latest.exhaustion.score} of 4
                </span>
              </div>
              <div className="metric">
                <span className="metric-label">Disengagement</span>
                <span className="metric-value">
                  {BINARY_LABELS[latest.disengagement.level]}
                </span>
                <span className="metric-note">
                  OLBI mean {latest.disengagement.score} of 4
                </span>
              </div>
            </div>
          </section>

          <section className="card">
            <p className="eyebrow">Recommended follow-up</p>
            <p className="card-text note-text">{latest.recommendation.en}</p>
            <p className="fine-print" lang="id">
              {latest.recommendation.id}
            </p>
          </section>

          {latestRule && (
            <section className="card">
              <p className="eyebrow">About rule {latestRule.id}</p>
              <p className="card-text note-text">{latestRule.rationale.en}</p>
              <p className="fine-print">
                This is the campus psychologist’s general explanation of the
                rule this result matched. It describes the rule, not an
                individual assessment of this student.
              </p>
            </section>
          )}

          <section className="card">
            <p className="eyebrow">Screening history</p>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th scope="col">Date</th>
                    <th scope="col">Result</th>
                    <th scope="col">Workload</th>
                    <th scope="col">Exhaustion</th>
                    <th scope="col">Disengagement</th>
                    <th scope="col">Rule</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => (
                    <tr key={entry.id}>
                      <th scope="row">
                        {dateFormat.format(new Date(entry.createdAt))}
                      </th>
                      <td>
                        <RiskBadge category={entry.category} />
                      </td>
                      <td>{WORKLOAD_LABELS[entry.workload.level]}</td>
                      <td>{BINARY_LABELS[entry.exhaustion.level]}</td>
                      <td>{BINARY_LABELS[entry.disengagement.level]}</td>
                      <td>{entry.ruleId}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      <p className="fine-print">
        This page shows screening summaries only. The student’s individual
        answers are not shown. A screening result is not a diagnosis.
      </p>

      <section className="card">
        <p className="eyebrow">Your student list</p>
        {confirmingRemove ? (
          <div className="inline-confirm">
            <p>
              Remove {student.fullName || 'this student'} from your list? You
              will no longer see their results. They can connect again with
              your code.
            </p>
            <button
              type="button"
              className="button-primary button-small"
              disabled={removing}
              onClick={handleRemove}
            >
              {removing ? 'Removing…' : 'Yes, remove'}
            </button>
            <button
              type="button"
              className="button-secondary button-small"
              disabled={removing}
              onClick={() => setConfirmingRemove(false)}
            >
              Cancel
            </button>
          </div>
        ) : (
          <>
            <p className="card-text">
              Not one of your students? You can remove them from your list.
            </p>
            <button
              type="button"
              className="button-secondary button-small"
              onClick={() => setConfirmingRemove(true)}
            >
              Remove from my students
            </button>
          </>
        )}
        {removeFailed && (
          <p className="form-error" role="alert">
            We could not remove this student. Please try again.
          </p>
        )}
      </section>
    </div>
  );
}
