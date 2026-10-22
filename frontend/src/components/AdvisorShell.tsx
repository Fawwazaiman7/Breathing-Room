import { NavLink, Outlet, useLocation } from 'react-router-dom';
import '../advisor/advisor.css';
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
  const { pathname } = useLocation();
  const onProfile = pathname.startsWith('/advisor/profile');
  const drawer = useDrawer();

  return (
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
