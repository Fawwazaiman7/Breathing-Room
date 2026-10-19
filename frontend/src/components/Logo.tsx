import { Link } from 'react-router-dom';
import { useT } from '../i18n/strings';
import { LeafIcon } from './Icons';

interface LogoProps {
  /** The smaller size used in the landing page header. */
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  const t = useT();
  return (
    <span className={compact ? 'logo logo-compact' : 'logo'}>
      <span className="logo-mark">
        <LeafIcon size={compact ? 19 : 22} />
      </span>
      {compact ? (
        <span className="logo-name">{t.appName}</span>
      ) : (
        <span className="logo-text">
          <span className="logo-name">{t.appName}</span>
          <span className="logo-tagline">{t.tagline}</span>
        </span>
      )}
    </span>
  );
}

/** The logo as a link back to the landing page. */
export function LogoLink({ compact = false }: LogoProps) {
  const t = useT();
  return (
    <Link
      to="/"
      className="logo-link"
      aria-label={t.nav.homeLabel}
      title={t.nav.homeHint}
    >
      <Logo compact={compact} />
    </Link>
  );
}
