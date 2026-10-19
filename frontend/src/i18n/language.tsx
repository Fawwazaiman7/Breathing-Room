import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { ReactNode } from 'react';

/** Interface languages. English is the default. */
export type Language = 'en' | 'id';

const STORAGE_KEY = 'breathing-room:language';

function readStored(): Language {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'id' ? 'id' : 'en';
  } catch {
    return 'en';
  }
}

interface LanguageState {
  language: Language;
  setLanguage: (language: Language) => void;
  /** False inside the advisor workspace, which is English only. */
  switchable: boolean;
}

const LanguageContext = createContext<LanguageState>({
  language: 'en',
  setLanguage: () => undefined,
  switchable: true,
});

/** Holds the student's chosen language for the whole app. */
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setState] = useState<Language>(readStored);

  const setLanguage = useCallback((next: Language) => {
    setState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // The choice still applies for this visit.
    }
  }, []);

  // Keeps <html lang> in step, so screen readers pronounce the text correctly.
  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo(
    () => ({ language, setLanguage, switchable: true }),
    [language, setLanguage],
  );

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
}


/** Fixes one part of the app to English (the advisor workspace). */
export function EnglishOnly({ children }: { children: ReactNode }) {
  const value = useMemo(
    () => ({ language: 'en' as Language, setLanguage: () => undefined, switchable: false }),
    [],
  );
  return (
    <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageState {
  return useContext(LanguageContext);
}

/** Locale for dates and times. */
export function localeOf(language: Language): string {
  return language === 'id' ? 'id-ID' : 'en-GB';
}
