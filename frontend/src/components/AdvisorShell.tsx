import { NavLink, Outlet, useLocation } from 'react-router-dom';
import '../advisor/advisor.css';
import { useAuth } from '../auth/useAuth';
import { GuideButton, TourProvider } from '../tour/Tour';
import { EnglishOnly } from '../i18n/language';
import { DrawerClose, DrawerScrim, MobileBar, useDrawer } from './Drawer';
import { HomeIcon } from './Icons';
import { LogoLink } from './Logo';
import { SidebarAccount } from './SidebarAccount';

/** Advisor workspace layout: sidebar on the left (a drawer on a phone). */
export function AdvisorShell() {
  // The advisor workspace is English only.
  return (
    <EnglishOnly>
      <AdvisorLayout />
    </EnglishOnly>
  );
}

function AdvisorLayout() {
  const { profile } = useAuth();
  const { pathname } = useLocation();
  const onProfile = pathname.startsWith('/advisor/profile');
  const drawer = useDrawer();

  return (
    // The guide opens by itself the first time an advisor reaches the student list.
    <TourProvider
      variant="advisor"
      userId={profile?.id ?? null}
      autoStart={pathname === '/advisor' || pathname === '/advisor/'}
    >
      <div className="shell">
        <MobileBar
          open={drawer.open}
          onOpen={() => drawer.setOpen(true)}
          menuRef={drawer.menuRef}
          sound={false}
        />
        <DrawerScrim open={drawer.open} onClose={drawer.close} />
        <aside
          id="workspace-sidebar"
          ref={drawer.panelRef}
          tabIndex={-1}
          className={drawer.open ? 'sidebar open' : 'sidebar'}
          aria-label="Advisor workspace"
        >
          <div className="sidebar-top">
            <LogoLink />
            <DrawerClose onClose={drawer.close} />
          </div>
          <p className="sidebar-heading">Advisor workspace</p>
          <nav className="sidebar-nav" aria-label="Advisor workspace">
            <NavLink
              to="/advisor"
              data-tour="students"
              className={({ isActive }: { isActive: boolean }) =>
                isActive && !onProfile ? 'nav-link active' : 'nav-link'
              }
            >
              <HomeIcon /> Students
            </NavLink>
          </nav>

          <div className="sidebar-tools">
            <GuideButton />
          </div>

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
    </TourProvider>
  );
}
