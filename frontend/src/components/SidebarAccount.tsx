import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { ChevronRightIcon, SignOutIcon } from './Icons';

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    return '?';
  }
  const first = parts[0][0];
  const last = parts.length > 1 ? parts[parts.length - 1][0] : '';
  return (first + last).toUpperCase();
}

interface SidebarAccountProps {
  /** Shown when the profile has no name yet. */
  fallbackName: string;
  /** The line under the name, e.g. "Student · TI 6A". */
  meta: string;
  /** Where the profile page lives for this workspace. */
  profilePath: string;
}

/** Bottom of the sidebar: a link to the profile page, and Sign out. */
export function SidebarAccount({
  fallbackName,
  meta,
  profilePath,
}: SidebarAccountProps) {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const name = profile?.full_name || fallbackName;

  async function handleSignOut() {
    await signOut();
    navigate('/', { replace: true });
  }

  return (
    <div className="sidebar-footer">
      <NavLink
        to={profilePath}
        className={({ isActive }: { isActive: boolean }) =>
          isActive ? 'sidebar-user active' : 'sidebar-user'
        }
        aria-label={`Your profile: ${name}`}
        title="View and edit your profile"
      >
        <span className="avatar">{initialsOf(name)}</span>
        <span className="sidebar-user-text">
          <span className="sidebar-user-name">{name}</span>
          <span className="sidebar-user-meta">{meta}</span>
        </span>
        <ChevronRightIcon size={16} />
      </NavLink>
      <button type="button" className="link-button" onClick={handleSignOut}>
        <SignOutIcon /> Sign out
      </button>
    </div>
  );
}
