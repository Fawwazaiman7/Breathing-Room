import { useEffect } from 'react';
import { useT } from '../i18n/strings';

/** Sets the browser tab title, e.g. "Your result · Ruang Pulih". */
export function usePageTitle(title?: string) {
  const t = useT();
  useEffect(() => {
    document.title = title
      ? `${title} · ${t.appName}`
      : `${t.appName} · ${t.tagline}`;
  }, [title, t]);
}
