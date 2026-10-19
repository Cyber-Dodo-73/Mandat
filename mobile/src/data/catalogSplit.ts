// Also used by scripts/sync-cards.ts (run with tsx): keep it free of app imports and aliases.

type Localized = { fr: string; en: string };

/** One dated entry of a card's Wikidata timeline. */
export type TimelineEntry = {
  year: number;
  endYear?: number;
  kind: 'birth' | 'death' | 'office' | 'award' | 'event' | 'education';
  label: Localized;
  wikidataId?: string;
};

/** Long-form history of a card, loaded lazily (it weighs more than the rest of the catalog). */
export type CardHistory = {
  story?: Localized;
  highlights?: { fr: string[]; en: string[] };
  legacy?: Localized;
  timeline?: TimelineEntry[];
};

/** Fields moved out of the startup index into the lazily loaded history chunks. */
export const HISTORY_FIELDS = ['story', 'highlights', 'legacy', 'timeline'] as const;

/** Cards per history chunk: opening a card's history evaluates ~1/10 of the long-form data. */
export const HISTORY_CHUNK_SIZE = 50;

type RawCard = { id: string; number: number } & Record<string, unknown>;
type RawCatalog = { cards: RawCard[] } & Record<string, unknown>;

/** Chunk holding a card, from its collector number (1-based). */
export function historyChunkOf(cardNumber: number, chunkSize = HISTORY_CHUNK_SIZE): number {
  return Math.max(0, Math.floor((cardNumber - 1) / chunkSize));
}

/**
 * Splits the full catalog into the light startup index and history chunks keyed by card id.
 * Cards keep their order; a card without long-form fields simply has no history entry.
 */
export function splitCatalog(
  catalog: RawCatalog,
  chunkSize = HISTORY_CHUNK_SIZE,
): { index: RawCatalog; chunks: Record<string, CardHistory>[] } {
  const chunks: Record<string, CardHistory>[] = [];
  const cards = catalog.cards.map((card) => {
    const light: Record<string, unknown> = {};
    const history: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(card)) {
      if ((HISTORY_FIELDS as readonly string[]).includes(key)) history[key] = value;
      else light[key] = value;
    }
    const chunk = historyChunkOf(card.number, chunkSize);
    while (chunks.length <= chunk) chunks.push({});
    if (Object.keys(history).length > 0) chunks[chunk]![card.id] = history as CardHistory;
    return light as RawCard;
  });
  return { index: { ...catalog, cards }, chunks };
}
