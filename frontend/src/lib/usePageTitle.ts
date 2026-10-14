import { useEffect } from 'react';

const APP_NAME = 'Breathing Room';

/** Sets the browser tab title, e.g. "Your result · Breathing Room". */
export function usePageTitle(title?: string) {
  useEffect(() => {
    document.title = title ? `${title} · ${APP_NAME}` : `${APP_NAME} · Academic burnout screening`;
  }, [title]);
}
