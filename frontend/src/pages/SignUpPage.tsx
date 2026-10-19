import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, Navigate } from 'react-router-dom';
import '../advising/advising.css';
import { useAuth } from '../auth/useAuth';
import { AuthLayout } from '../components/AuthLayout';
import { VerifyEmailCard } from '../components/VerifyEmailCard';
import { useLanguage } from '../i18n/language';
import { translateMessage } from '../i18n/messages';
import { useT } from '../i18n/strings';
import { usePageTitle } from '../lib/usePageTitle';

/**
 * Sign-up for students. The email address is confirmed with a code before
 * the account can be used. Advisor accounts are created by the administrator.
 */
export function SignUpPage() {
  const t = useT();
  const { language } = useLanguage();
  usePageTitle(t.titles.signUp);
  const { status, profile, signUp } = useAuth();
  const [fullName, setFullName] = useState('');
  const [studentNumber, setStudentNumber] = useState('');
  const [className, setClassName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [verifying, setVerifying] = useState<string | null>(null);

  if (status === 'signedIn' && profile) {
    return (
      <Navigate to={profile.role === 'advisor' ? '/advisor' : '/app'} replace />
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const address = email.trim().toLowerCase();
    setBusy(true);
    setError(null);
    const result = await signUp({
      fullName: fullName.trim(),
      studentNumber: studentNumber.trim(),
      className: className.trim(),
      email: address,
      password,
    });
    if (!result.ok) {
      setError(translateMessage(result.message, language));
    } else if (result.needsEmailConfirmation) {
      setVerifying(address);
    }
    // When no confirmation is needed, the session starts and the redirect
    // above takes over.
    setBusy(false);
  }

  if (verifying) {
    return (
      <AuthLayout>
        <VerifyEmailCard
          email={verifying}
          sentNow
          onCancel={() => setVerifying(null)}
        />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <form className="auth-card" onSubmit={handleSubmit}>
        <h1 className="card-title">{t.auth.signUpTitle}</h1>
        <p className="card-text">{t.auth.signUpText}</p>

        <label className="field">
          <span>{t.auth.fullName}</span>
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
          <span>{t.auth.studentNumber}</span>
          <input
            name="studentNumber"
            inputMode="numeric"
            pattern="[0-9]{5,20}"
            title={t.auth.digitsOnly}
            required
            value={studentNumber}
            onChange={(event) => setStudentNumber(event.target.value)}
          />
        </label>
        <label className="field">
          <span>{t.auth.className}</span>
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
          <span>{t.common.email}</span>
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
          <span>{t.common.password}</span>
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
          {busy ? t.auth.creating : t.auth.createButton}
        </button>
        <p className="auth-footnote">
          {t.auth.haveAccount}{' '}
          <Link to="/sign-in?as=student">{t.common.signIn}</Link>
        </p>
      </form>
    </AuthLayout>
  );
}
