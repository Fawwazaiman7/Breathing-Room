import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { useT } from '../i18n/strings';
import { ArrowLeftIcon } from './Icons';
import { LogoLink } from './Logo';

/** Frame for the sign-in and sign-up pages, with a way back to the landing page. */
export function AuthLayout({ children }: { children: ReactNode }) {
  const t = useT();
  return (
    <div className="auth-page">
      <div className="auth-top">
        <Link className="back-home" to="/">
          <ArrowLeftIcon size={18} /> {t.common.backToHome}
        </Link>
        <LanguageSwitch />
      </div>
      <LogoLink />
      {children}
    </div>
  );
}
