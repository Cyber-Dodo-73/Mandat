import type { components } from '@/lib/api';
import type { CardFinish } from '@/types/card';

export type CardRef = components['schemas']['CardRef'];

/** The server accepts at most this many cards in the showcase. */
export const SHOWCASE_MAX = 6;

export const refKey = (ref: CardRef) => `${ref.cardId}:${ref.finish}`;

export const sameRef = (a: CardRef | null | undefined, b: CardRef | null | undefined) =>
  Boolean(a && b && a.cardId === b.cardId && a.finish === b.finish);

/** Moves the item at `from` to `to`, shifting the others (drag-and-drop reorder). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || from >= items.length) return [...items];
  const target = Math.max(0, Math.min(items.length - 1, to));
  const next = [...items];
  const [moved] = next.splice(from, 1);
  if (moved === undefined) return [...items];
  next.splice(target, 0, moved);
  return next;
}

export type ShowcaseToggle = { showcase: CardRef[]; result: 'added' | 'removed' | 'full' };

/** Adds the card if absent (when there is room), removes it if present. */
export function toggleShowcase(showcase: readonly CardRef[], ref: CardRef, max = SHOWCASE_MAX): ShowcaseToggle {
  if (showcase.some((entry) => sameRef(entry, ref))) {
    return { showcase: showcase.filter((entry) => !sameRef(entry, ref)), result: 'removed' };
  }
  if (showcase.length >= max) return { showcase: [...showcase], result: 'full' };
  return { showcase: [...showcase, ref], result: 'added' };
}

/**
 * Slot index under a point of a grid of `columns` columns (cell size + gap), clamped to the
 * existing items. Used while dragging a showcase card.
 */
export function slotAt(
  x: number,
  y: number,
  layout: { columns: number; cellWidth: number; cellHeight: number; gap: number; count: number },
): number {
  'worklet';
  const column = Math.max(0, Math.min(layout.columns - 1, Math.floor(x / (layout.cellWidth + layout.gap))));
  const row = Math.max(0, Math.floor(y / (layout.cellHeight + layout.gap)));
  return Math.max(0, Math.min(layout.count - 1, row * layout.columns + column));
}

/** Finish ranking used to suggest the best copy of a card first. */
const FINISH_RANK: Record<CardFinish, number> = { gold: 0, full_art: 1, holo: 2, standard: 3 };

export function byBestFinish(a: { finish: CardFinish }, b: { finish: CardFinish }): number {
  return FINISH_RANK[a.finish] - FINISH_RANK[b.finish];
}
