import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import '../advising/advising.css';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/AuthLayout';

/** Sign-up for students. Advisor accounts are created by the administrator. */
export function SignUpPage() {
  const { status, profile, signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [className, setClassName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState(false);

  if (status === 'signedIn' && profile) {
    return (
      <Navigate to={profile.role === 'advisor' ? '/advisor' : '/app'} replace />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signUp({
      fullName: fullName.trim(),
      studentNumber: studentNumber.trim(),
      className: className.trim(),
      email: email.trim(),
      password,
    });
    if (!result.ok) {
      setError(result.message);
    } else if (result.needsEmailConfirmation) {
      setConfirmEmail(true);
    }
    // When no confirmation is needed, the session starts and the redirect
    // above takes over.
    setBusy(false);
  }

  if (confirmEmail) {
    return (
      <AuthLayout>
        <section className="auth-card">
          <h1 className="card-title">Check your email</h1>
          <p className="card-text">
            We sent a confirmation link to {email.trim()}. Open it to activate
            your account, then sign in.
          </p>
          <Link className="button-primary" to="/sign-in?as=student">
            Go to sign in
          </Link>
        </section>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="card-title">Create a student account</h1>
        <p className="card-text">
          For students. Academic Advisors receive their account from the
          administrator.
        </p>

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
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            name="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </label>
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            name="password"
            autoComplete="new-password"
            required
            minLength={8}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </label>

        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}

        <button type="submit" className="button-primary" disabled={busy}>
          {busy ? 'Creating account…' : 'Create account'}
        </button>
        <p className="auth-footnote">
          Already have an account? <Link to="/sign-in?as=student">Sign in</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
