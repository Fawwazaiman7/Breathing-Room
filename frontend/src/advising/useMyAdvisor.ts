import { useEffect, useState } from 'react';
import { fetchMyAdvisor } from './api';
import type { MyAdvisor } from './api';

export type MyAdvisorState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; advisor: MyAdvisor | null };

/** The signed-in student's Academic Advisor, loaded from the backend. */
export function useMyAdvisor(): {
  state: MyAdvisorState;
  setAdvisor: (advisor: MyAdvisor) => void;
} {
  const [state, setState] = useState<MyAdvisorState>({ status: 'loading' });

  useEffect(() => {
    let active = true;
    fetchMyAdvisor()
      .then((result) => {
        if (active) {
          setState({ status: 'ready', advisor: result.advisor });
        }
      })
      .catch(() => {
        if (active) {
          setState({ status: 'error' });
        }
      });
    return () => {
      active = false;
    };
  }, []);

  return {
    state,
    setAdvisor: (advisor) => setState({ status: 'ready', advisor }),
  };
}
