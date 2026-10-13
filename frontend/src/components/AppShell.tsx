import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { BookIcon, HomeIcon, MessageIcon } from './Icons';
import { LogoLink } from './Logo';
import { SidebarAccount } from './SidebarAccount';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link active' : 'nav-link';

/** Student workspace layout: sidebar on the left, page on the right. */
export function AppShell() {
  const { profile } = useAuth();

  return (
    <div className="shell">
      <aside className="sidebar">
        <LogoLink />
        <p className="sidebar-heading">Student workspace</p>
        <nav className="sidebar-nav" aria-label="Student workspace">
          <NavLink to="/app" end className={navClass}>
            <HomeIcon /> Overview
          </NavLink>
          <NavLink to="/app/screening" className={navClass}>
            <BookIcon /> Screening
          </NavLink>
          <NavLink to="/app/support" className={navClass}>
            <MessageIcon /> Support chat
          </NavLink>
        </nav>

        <SidebarAccount
          fallbackName="Student"
          meta={`Student${profile?.class_name ? ` · ${profile.class_name}` : ''}`}
          profilePath="/app/profile"
        />
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
