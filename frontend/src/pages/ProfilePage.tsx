import { useState } from 'react';
import type { FormEvent } from 'react';
import type { Profile } from '../auth/auth-context';
import { useAuth } from '../auth/useAuth';
import { ApiError } from '../lib/api';
import { updateProfile } from '../profile/api';
import '../profile/profile.css';
import { usePageTitle } from '../lib/usePageTitle';

type Feedback = { kind: 'saved' | 'error'; text: string } | null;

function FeedbackLine({ feedback }: { feedback: Feedback }) {
  if (!feedback) {
    return null;
  }
  return feedback.kind === 'error' ? (
    <p className="form-error" role="alert">
      {feedback.text}
    </p>
  ) : (
    <p className="form-success" role="status">
      {feedback.text}
    </p>
  );
}

function DetailsForm({
  profile,
  email,
}: {
  profile: Profile;
  email: string | null;
}) {
  const { refreshProfile } = useAuth();
  const isStudent = profile.role === 'student';
  const [fullName, setFullName] = useState(profile.full_name);
  const [studentNumber, setStudentNumber] = useState(
    profile.student_number ?? '',
  );
  const [className, setClassName] = useState(profile.class_name ?? '');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  const unchanged =
    fullName.trim() === profile.full_name &&
    (!isStudent ||
      (studentNumber.trim() === (profile.student_number ?? '') &&
        className.trim() === (profile.class_name ?? '')));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setFeedback(null);
    try {
      const saved = await updateProfile(
        isStudent
          ? {
              fullName: fullName.trim(),
              studentNumber: studentNumber.trim(),
              className: className.trim(),
            }
          : { fullName: fullName.trim() },
      );
      // Show the values exactly as they were stored (extra spaces removed).
      setFullName(saved.fullName);
      setStudentNumber(saved.studentNumber ?? '');
      setClassName(saved.className ?? '');
      await refreshProfile();
      setFeedback({ kind: 'saved', text: 'Your changes are saved.' });
    } catch (error) {
      setFeedback({
        kind: 'error',
        text:
          error instanceof ApiError
            ? error.message
            : 'We could not save your changes. Please try again.',
      });
    }
    setBusy(false);
  }

  return (
    <section className="card">
      <h2 className="card-title">Personal details</h2>
      <form className="profile-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Full name</span>
          <input
            name="fullName"
            autoComplete="name"
            required
            maxLength={120}
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
          />
        </label>

        {isStudent && (
          <>
            <label className="field">
              <span>Student number (NIM)</span>
              <input
                name="studentNumber"
                inputMode="numeric"
                pattern="[0-9]{5,20}"
                title="Digits only"
                required
                value={studentNumber}
                onChange={(event) => setStudentNumber(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Class</span>
              <input
                name="className"
                placeholder="TI 6A"
                required
                maxLength={30}
                value={className}
                onChange={(event) => setClassName(event.target.value)}
              />
            </label>
          </>
        )}

        {/* The hint sits outside the label so it is read as a description. */}
        <div className="field">
          <label htmlFor="profile-email">Email</label>
          <input
            id="profile-email"
            type="email"
            name="email"
            value={email ?? ''}
            readOnly
            aria-describedby="profile-email-hint"
          />
          <span id="profile-email-hint" className="field-hint">
            This is the email you sign in with. It cannot be changed here.
          </span>
        </div>

        <FeedbackLine feedback={feedback} />

        <button
          type="submit"
          className="button-primary"
          disabled={busy || unchanged}
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </form>
    </section>
  );
}

function PasswordForm() {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (next !== confirm) {
      setFeedback({
        kind: 'error',
        text: 'The two new passwords do not match.',
      });
      return;
    }
    if (next === current) {
      setFeedback({
        kind: 'error',
        text: 'Choose a new password that is different from the current one.',
      });
      return;
    }
    setBusy(true);
    setFeedback(null);
    const message = await changePassword(current, next);
    if (message) {
      setFeedback({ kind: 'error', text: message });
    } else {
      setCurrent('');
      setNext('');
      setConfirm('');
      setFeedback({ kind: 'saved', text: 'Your password has been changed.' });
    }
    setBusy(false);
  }

  return (
    <section className="card">
      <h2 className="card-title">Password</h2>
      <form className="profile-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Current password</span>
          <input
            type="password"
            name="currentPassword"
            autoComplete="current-password"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
          />
        </label>
        <div className="field">
          <label htmlFor="profile-new-password">New password</label>
          <input
            id="profile-new-password"
            type="password"
            name="newPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={next}
            onChange={(event) => setNext(event.target.value)}
            aria-describedby="profile-new-password-hint"
          />
          <span id="profile-new-password-hint" className="field-hint">
            At least 8 characters.
          </span>
        </div>
        <label className="field">
          <span>Confirm new password</span>
          <input
            type="password"
            name="confirmPassword"
            autoComplete="new-password"
            required
            minLength={8}
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
          />
        </label>

        <FeedbackLine feedback={feedback} />

        <button type="submit" className="button-secondary" disabled={busy}>
          {busy ? 'Changing…' : 'Change password'}
        </button>
      </form>
    </section>
  );
}

/** Account page for both students and Academic Advisors. */
export function ProfilePage() {
  usePageTitle('Profile');
  const { profile, email } = useAuth();
  if (!profile) {
    return null;
  }
  const isStudent = profile.role === 'student';

  return (
    <div className="page page-narrow">
      <header className="profile-header">
        <p className="eyebrow">
          {isStudent ? 'Student account' : 'Academic Advisor account'}
        </p>
        <h1 className="profile-title">Your profile</h1>
        <p className="card-text">
          {isStudent
            ? 'Your Academic Advisor sees your name, student number and class.'
            : 'Students see your name when they connect to you with your code.'}
        </p>
      </header>

      <DetailsForm profile={profile} email={email} />
      <PasswordForm />
    </div>
  );
}
