import { CATEGORY_CONTENT } from '../screening/content';
import type { ScreeningCategory } from '../screening/types';

export function RiskBadge({ category }: { category: ScreeningCategory }) {
  const content = CATEGORY_CONTENT[category];
  return <span className={`badge badge-${content.tone}`}>{content.label}</span>;
}
