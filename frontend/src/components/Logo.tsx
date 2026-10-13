import { Link } from 'react-router-dom';
import { LeafIcon } from './Icons';

interface LogoProps {
  /** The smaller size used in the landing page header. */
  compact?: boolean;
}

export function Logo({ compact = false }: LogoProps) {
  return (
    <span className={compact ? 'logo logo-compact' : 'logo'}>
      <span className="logo-mark">
        <LeafIcon size={compact ? 19 : 22} />
      </span>
      <span className="logo-name">Breathing Room</span>
    </span>
  );
}

/** The logo as a link back to the landing page. */
export function LogoLink({ compact = false }: LogoProps) {
  return (
    <Link
      to="/"
      className="logo-link"
      aria-label="Breathing Room home page"
      title="Back to the home page"
    >
      <Logo compact={compact} />
    </Link>
  );
}
