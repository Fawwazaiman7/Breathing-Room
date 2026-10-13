import { NavLink, Outlet, useLocation } from 'react-router-dom';
import '../advisor/advisor.css';
import { HomeIcon } from './Icons';
import { LogoLink } from './Logo';
import { SidebarAccount } from './SidebarAccount';

/** Advisor workspace layout: sidebar on the left, page on the right. */
export function AdvisorShell() {
  const { pathname } = useLocation();
  const onProfile = pathname.startsWith('/advisor/profile');

  return (
    <div className="shell">
      <aside className="sidebar">
        <LogoLink />
        <p className="sidebar-heading">Advisor workspace</p>
        <nav className="sidebar-nav" aria-label="Advisor workspace">
          <NavLink
            to="/advisor"
            className={({ isActive }: { isActive: boolean }) =>
              isActive && !onProfile ? 'nav-link active' : 'nav-link'
            }
          >
            <HomeIcon /> Students
          </NavLink>
        </nav>

        <SidebarAccount
          fallbackName="Advisor"
          meta="Academic Advisor"
          profilePath="/advisor/profile"
        />
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
