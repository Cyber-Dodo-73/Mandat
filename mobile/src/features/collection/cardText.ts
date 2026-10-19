import { useLanguage, useTranslation, type Language } from '@/i18n';
import type { Card, Localized } from '@/types/card';

export function localize(value: Localized, language: Language): string {
  return value[language] || value.fr;
}

/** Collector number as printed on the card: "042/500". */
export function formatCollectorNumber(number: number, total: number): string {
  const width = String(total).length;
  return `${String(number).padStart(width, '0')}/${total}`;
}

/** Up to two initials for the procedural monogram ("Nelson Mandela" → "NM"). */
export function monogram(name: string): string {
  const words = name
    .replace(/\b(de|du|des|la|le|of|the|von|van|da|di|del|bin|ibn|al|jr|sr)\b\.?/gi, ' ')
    .split(/[\s-]+/)
    .filter((word) => /\p{L}/u.test(word));
  const roman = /^[IVXLCDM]+$/;
  const letters = words.filter((word) => !roman.test(word)).map((word) => word.match(/\p{L}/u)?.[0] ?? '');
  if (letters.length === 0) return name.slice(0, 1).toUpperCase();
  if (letters.length === 1) return letters[0]!.toUpperCase();
  return `${letters[0]}${letters[letters.length - 1]}`.toUpperCase();
}

export type CardText = {
  name: string;
  role: string;
  bio: string;
  abilityName: string;
  abilityDescription: string;
  lifespan: string;
};

/** Formats a year, negative years being BC ("-69" → "69 av. J.-C."). */
export type YearFormatter = (year: number) => string;

export function cardText(card: Card, language: Language, formatYear: YearFormatter = String): CardText {
  const birth = formatYear(card.birthYear);
  return {
    name: localize(card.name, language),
    role: localize(card.role, language),
    bio: localize(card.bio, language),
    abilityName: localize(card.ability.name, language),
    abilityDescription: localize(card.ability.description, language),
    lifespan: card.deathYear === null ? birth : `${birth} – ${formatYear(card.deathYear)}`,
  };
}

export function useCardText(card: Card): CardText {
  const { t } = useTranslation();
  const language = useLanguage();
  const formatYear: YearFormatter = (year) => (year < 0 ? t('card.yearBC', { year: -year }) : String(year));
  return cardText(card, language, formatYear);
}
