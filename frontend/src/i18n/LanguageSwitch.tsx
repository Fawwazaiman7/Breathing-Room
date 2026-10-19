import { useLanguage } from './language';
import type { Language } from './language';

const OPTIONS: { value: Language; short: string; name: string }[] = [
  { value: 'en', short: 'EN', name: 'English' },
  { value: 'id', short: 'ID', name: 'Bahasa Indonesia' },
];

/** A small two-option switch: EN | ID. Hidden where only English is offered. */
export function LanguageSwitch({ className = '' }: { className?: string }) {
  const { language, setLanguage, switchable } = useLanguage();
  if (!switchable) {
    return null;
  }
  return (
    <div
      className={`lang-switch ${className}`.trim()}
      role="group"
      aria-label={language === 'id' ? 'Bahasa tampilan' : 'Display language'}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          lang={option.value}
          title={option.name}
          aria-label={option.name}
          aria-pressed={language === option.value}
          className={language === option.value ? 'active' : ''}
          onClick={() => setLanguage(option.value)}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
