import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { useT } from '../i18n/strings';
import { BookIcon, HomeIcon, MessageIcon } from './Icons';
import { LogoLink } from './Logo';
import { SidebarAccount } from './SidebarAccount';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link active' : 'nav-link';

/** Student workspace layout: sidebar on the left, page on the right. */
export function AppShell() {
  const { profile } = useAuth();
  const t = useT();

  return (
    <div className="shell">
      <aside className="sidebar">
        <LogoLink />
        <p className="sidebar-heading">{t.nav.workspace}</p>
        <nav className="sidebar-nav" aria-label={t.nav.workspace}>
          <NavLink to="/app" end className={navClass}>
            <HomeIcon /> {t.nav.overview}
          </NavLink>
          <NavLink to="/app/screening" className={navClass}>
            <BookIcon /> {t.nav.screening}
          </NavLink>
          <NavLink to="/app/support" className={navClass}>
            <MessageIcon /> {t.nav.chat}
          </NavLink>
        </nav>

        <LanguageSwitch className="sidebar-lang" />

        <SidebarAccount
          fallbackName={t.nav.student}
          meta={`${t.nav.student}${profile?.class_name ? ` · ${profile.class_name}` : ''}`}
          profilePath="/app/profile"
        />
      </aside>

      <main className="shell-main">
        <Outlet />
      </main>
    </div>
  );
}
