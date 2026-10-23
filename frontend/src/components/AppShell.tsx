import { useEffect } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { LanguageSwitch } from '../i18n/LanguageSwitch';
import { useT } from '../i18n/strings';
import { ambient } from '../sound/ambient';
import { SoundButton } from '../sound/SoundButton';
import { GuideButton, TourProvider } from '../tour/Tour';
import { DrawerClose, DrawerScrim, MobileBar, useDrawer } from './Drawer';
import { BookIcon, HomeIcon, MessageIcon } from './Icons';
import { LogoLink } from './Logo';
import { SidebarAccount } from './SidebarAccount';

const navClass = ({ isActive }: { isActive: boolean }) =>
  isActive ? 'nav-link active' : 'nav-link';

/** Student workspace layout: sidebar on the left (a drawer on a phone). */
export function AppShell() {
  const { profile } = useAuth();
  const t = useT();
  const { pathname } = useLocation();
  const drawer = useDrawer();

  // Leaving the workspace (signing out) stops the background sound.
  useEffect(() => () => ambient.stop(), []);

  return (
    // The guide opens by itself the first time a student reaches the overview.
    <TourProvider userId={profile?.id ?? null} autoStart={pathname === '/app'}>
      <div className="shell">
        <MobileBar
          open={drawer.open}
          onOpen={() => drawer.setOpen(true)}
          menuRef={drawer.menuRef}
        />
        <DrawerScrim open={drawer.open} onClose={drawer.close} />
        <aside
          id="workspace-sidebar"
          ref={drawer.panelRef}
          tabIndex={-1}
          className={drawer.open ? 'sidebar open' : 'sidebar'}
          aria-label={t.nav.workspace}
        >
          <div className="sidebar-top">
            <LogoLink />
            <DrawerClose onClose={drawer.close} />
          </div>
          <p className="sidebar-heading">{t.nav.workspace}</p>
          <nav className="sidebar-nav" aria-label={t.nav.workspace}>
            <NavLink to="/app" end className={navClass} data-tour="overview">
              <HomeIcon /> {t.nav.overview}
            </NavLink>
            <NavLink to="/app/screening" className={navClass} data-tour="screening">
              <BookIcon /> {t.nav.screening}
            </NavLink>
            <NavLink to="/app/support" className={navClass} data-tour="chat">
              <MessageIcon /> {t.nav.chat}
            </NavLink>
          </nav>

          <div className="sidebar-tools">
            <span data-tour="language" className="sidebar-lang-wrap">
              <LanguageSwitch className="sidebar-lang" />
            </span>
            <span className="sidebar-sound">
              <SoundButton placement="side" />
            </span>
            <GuideButton />
          </div>

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
    </TourProvider>
  );
}
