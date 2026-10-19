import { getCard } from '@/data/catalog';
import { portraitCredits, type PortraitCredit } from '@/data/portraits';
import type { Language } from '@/i18n';

const byCard = new Map(portraitCredits.map((credit) => [credit.cardId, credit]));

/** Attribution of the portrait shown on a card, if it has one. */
export function portraitCreditFor(cardId: string): PortraitCredit | undefined {
  return byCard.get(cardId);
}

export type CreditRow = PortraitCredit & { displayName: string; number: number };

/** Every credit with the card's localized name, in collector-number order. */
export function creditRows(language: Language): CreditRow[] {
  return portraitCredits
    .map((credit) => {
      const card = getCard(credit.cardId);
      return { ...credit, displayName: card?.name[language] ?? credit.name, number: card?.number ?? 0 };
    })
    .sort((a, b) => a.number - b.number);
}

const fold = (value: string) => value.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Matches the person, the photographer or the license, ignoring case and accents. */
export function matchesCredit(row: CreditRow, query: string): boolean {
  const needle = fold(query.trim());
  if (!needle) return true;
  return [row.displayName, row.name, row.artist ?? '', row.license ?? ''].some((field) => fold(field).includes(needle));
}
