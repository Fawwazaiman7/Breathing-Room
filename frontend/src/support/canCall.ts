import { useEffect, useState } from 'react';

/**
 * Whether this device can place a phone call from a tel: link.
 *
 * Phones (and most tablets) have a touch screen as their main pointer and
 * open the dialler. A computer with a mouse usually cannot call: a tel:
 * link there only opens an empty tab or an app picker. So on a computer
 * the number is copied instead, to be dialled from a phone.
 */
export function canPlaceCalls(): boolean {
  if (typeof window === 'undefined') return true;
  const coarse = window.matchMedia?.('(pointer: coarse)').matches ?? false;
  const mobileAgent = /Android|iPhone|iPad|iPod|Mobile/i.test(
    navigator.userAgent,
  );
  return coarse || mobileAgent;
}

export function useCanCall(): boolean {
  const [canCall, setCanCall] = useState(canPlaceCalls);
  useEffect(() => {
    const query = window.matchMedia?.('(pointer: coarse)');
    if (!query) return;
    const update = () => setCanCall(canPlaceCalls());
    query.addEventListener?.('change', update);
    return () => query.removeEventListener?.('change', update);
  }, []);
  return canCall;
}

/** Copies text to the clipboard; resolves false when the browser refuses. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      area.remove();
      return ok;
    } catch {
      return false;
    }
  }
}
