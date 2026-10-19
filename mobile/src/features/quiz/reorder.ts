/** Moves the item at `from` to `to`, shifting the others (pure, for the chronology question). */
export function moveItem<T>(items: readonly T[], from: number, to: number): T[] {
  const next = [...items];
  if (from < 0 || from >= next.length) return next;
  const target = Math.max(0, Math.min(next.length - 1, to));
  const [moved] = next.splice(from, 1);
  next.splice(target, 0, moved as T);
  return next;
}

/** Index a dragged row lands on, from its start index and vertical travel. */
export function dropIndex(from: number, translationY: number, rowHeight: number, count: number): number {
  if (rowHeight <= 0) return from;
  const target = from + Math.round(translationY / rowHeight);
  return Math.max(0, Math.min(count - 1, target));
}
