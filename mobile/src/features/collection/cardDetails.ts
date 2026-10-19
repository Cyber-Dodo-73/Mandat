import type { IconName } from '@/components/ui';
import { getCard } from '@/data/catalog';
import { useLanguage, useTranslation, type Language } from '@/i18n';
import type { Card, TimelineEntry, TimelineKind } from '@/types/card';

import { localize, type YearFormatter } from './cardText';

/** Long-form content of a card in one language. */
export type CardDetails = {
  bio: string;
  story: string | null;
  highlights: string[];
  legacy: string | null;
  timeline: TimelineRow[];
};

export type TimelineRow = {
  key: string;
  kind: TimelineKind;
  /** "1981" or "1981 – 1995" (BC years spelled out). */
  when: string;
  label: string;
};

export const TIMELINE_ICONS: Record<TimelineKind, IconName> = {
  birth: 'sunny-outline',
  death: 'moon-outline',
  office: 'flag-outline',
  award: 'trophy-outline',
  event: 'flash-outline',
  education: 'school-outline',
};

/** "1981", or "1981 – 1995" for a span (a span inside one year shows the year once). */
export function timelineSpan(entry: Pick<TimelineEntry, 'year' | 'endYear'>, formatYear: YearFormatter): string {
  const start = formatYear(entry.year);
  if (entry.endYear === undefined || entry.endYear === entry.year) return start;
  return `${start} – ${formatYear(entry.endYear)}`;
}

const AWARD = /(prix|nobel|médaille|medal|award|décor|légion|legion|honneur|honou?r|prize|ordre d|order of)/i;
const OFFICE =
  /(élu|président|premier ministre|première ministre|ministre|roi |reine|empereur|impératrice|pharaon|sultan|chancel|gouvern|consul|elected|president|prime minister|minister|king|queen|emperor|empress|pharaoh|chancellor|governor|crowned|couronn)/i;

/** Icon of a highlight, guessed from its wording: awards and offices stand out. */
export function highlightIcon(text: string): IconName {
  if (AWARD.test(text)) return 'trophy-outline';
  if (OFFICE.test(text)) return 'flag-outline';
  return 'star-outline';
}

function nonEmpty(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Long-form fields in `language`, French as fallback for any missing piece. */
export function cardDetails(card: Card, language: Language, formatYear: YearFormatter = String): CardDetails {
  const own = card.highlights?.[language] ?? [];
  const highlights = own.length > 0 ? own : (card.highlights?.fr ?? []);
  return {
    bio: localize(card.bio, language),
    story: card.story ? nonEmpty(localize(card.story, language)) : null,
    highlights: highlights.filter((item) => item.trim().length > 0),
    legacy: card.legacy ? nonEmpty(localize(card.legacy, language)) : null,
    timeline: (card.timeline ?? []).map((entry, index) => ({
      key: `${entry.kind}-${entry.year}-${entry.wikidataId ?? 'x'}-${index}`,
      kind: entry.kind,
      when: timelineSpan(entry, formatYear),
      label: localize(entry.label, language),
    })),
  };
}

/**
 * Single access point to a card's long-form content (bio, story, highlights, legacy, timeline).
 * Reads the bundled catalog synchronously today; a lazily-loaded store can replace the body
 * without touching the screens.
 */
export function useCardDetails(cardId: string): CardDetails | null {
  const { t } = useTranslation();
  const language = useLanguage();
  const card = getCard(cardId);
  if (!card) return null;
  const formatYear: YearFormatter = (year) => (year < 0 ? t('card.yearBC', { year: -year }) : String(year));
  return cardDetails(card, language, formatYear);
}
