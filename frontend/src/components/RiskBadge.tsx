import { useScreeningContent } from '../i18n/screening-content';
import type { ScreeningCategory } from '../screening/types';

export function RiskBadge({ category }: { category: ScreeningCategory }) {
  const content = useScreeningContent().categories[category];
  return <span className={`badge badge-${content.tone}`}>{content.label}</span>;
}
