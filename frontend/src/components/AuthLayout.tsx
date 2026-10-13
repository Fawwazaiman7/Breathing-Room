import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeftIcon } from './Icons';
import { LogoLink } from './Logo';

/** Frame for the sign-in and sign-up pages, with a way back to the landing page. */
export function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth-page">
      <Link className="back-home" to="/">
        <ArrowLeftIcon size={18} /> Back to home
      </Link>
      <LogoLink />
      {children}
    </div>
  );
}
