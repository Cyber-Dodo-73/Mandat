import type { Card } from '@/types/card';

/** FNV-1a: small, stable string hash (same pick for every player on a given day). */
function hash(value: string): number {
  let result = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index);
    result = Math.imul(result, 0x01000193) >>> 0;
  }
  return result;
}

/**
 * The featured figure of `day` ("2026-10-19"): deterministic, and never a sensitive card
 * (perpetrators of mass crimes are never put forward).
 */
export function pickFigureOfTheDay(cards: readonly Card[], day: string): Card | undefined {
  const eligible = cards.filter((card) => !card.sensitive);
  if (eligible.length === 0) return undefined;
  return eligible[hash(`figure:${day}`) % eligible.length];
}

const MIN_ANECDOTE_LENGTH = 40;

/** First sentence of a bio, skipping too-short cuts like "Né en 356 av." */
export function firstSentence(text: string): string {
  const ends = /[.!?…](?=\s|$)/g;
  let match: RegExpExecArray | null;
  while ((match = ends.exec(text)) !== null) {
    const end = match.index + 1;
    if (end >= MIN_ANECDOTE_LENGTH) return text.slice(0, end).trim();
  }
  return text.trim();
}
