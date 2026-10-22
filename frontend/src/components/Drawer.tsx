import { useCallback, useEffect, useRef, useState } from 'react';
import type { RefObject } from 'react';
import { useLocation } from 'react-router-dom';
import { useT } from '../i18n/strings';
import { SoundButton } from '../sound/SoundButton';
import { CloseIcon, MenuIcon } from './Icons';
import { LogoLink } from './Logo';

/** Other parts of the app (the guide) can open or close the drawer. */
export const DRAWER_EVENT = 'ruang-pulih:drawer';

export function setDrawer(open: boolean) {
  window.dispatchEvent(new CustomEvent<boolean>(DRAWER_EVENT, { detail: open }));
}

/**
 * The sidebar becomes a drawer on a phone or small tablet: a top bar with a
 * menu button, and the sidebar slides in from the left over a dimmed page.
 * It closes on a link, on the dim area, on the close button and on Escape,
 * and the page behind it does not scroll while it is open.
 */
export function useDrawer() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const menuRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);

  const close = useCallback(() => setOpen(false), []);

  // A new page closes it.
  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    const onEvent = (event: Event) =>
      setOpen(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener(DRAWER_EVENT, onEvent);
    return () => window.removeEventListener(DRAWER_EVENT, onEvent);
  }, []);

  useEffect(() => {
    if (!open) {
      return;
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false);
        menuRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    document.body.classList.add('drawer-open');
    // While the guide is showing, focus stays on the guide's card.
    if (!document.querySelector('.tour')) {
      panelRef.current?.focus();
    }
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.classList.remove('drawer-open');
    };
  }, [open]);

  return { open, setOpen, close, menuRef, panelRef };
}

export function MobileBar({
  open,
  onOpen,
  menuRef,
  sound = true,
}: {
  open: boolean;
  onOpen: () => void;
  menuRef: RefObject<HTMLButtonElement | null>;
  sound?: boolean;
}) {
  const t = useT();
  return (
    <header className="mobile-bar">
      <button
        ref={menuRef}
        type="button"
        className="mobile-menu-button"
        aria-label={t.nav.openMenu}
        aria-expanded={open}
        aria-controls="workspace-sidebar"
        onClick={onOpen}
        data-tour="menu"
      >
        <MenuIcon />
      </button>
      <LogoLink compact />
      <span className="mobile-bar-end">
        {sound && <SoundButton placement="down" />}
      </span>
    </header>
  );
}

export function DrawerClose({ onClose }: { onClose: () => void }) {
  const t = useT();
  return (
    <button
      type="button"
      className="drawer-close"
      aria-label={t.nav.closeMenu}
      onClick={onClose}
    >
      <CloseIcon size={20} />
    </button>
  );
}

export function DrawerScrim({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <div
      className={open ? 'drawer-scrim show' : 'drawer-scrim'}
      onClick={onClose}
      aria-hidden="true"
    />
  );
}
