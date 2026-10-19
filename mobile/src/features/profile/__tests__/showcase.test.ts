import { moveItem, slotAt, SHOWCASE_MAX, toggleShowcase, type CardRef } from '../showcase';

const ref = (cardId: string, finish: CardRef['finish'] = 'standard'): CardRef => ({ cardId, finish });

describe('moveItem', () => {
  const items = ['a', 'b', 'c', 'd'];

  it('moves an item forward and shifts the others back', () => {
    expect(moveItem(items, 0, 2)).toEqual(['b', 'c', 'a', 'd']);
  });

  it('moves an item backward', () => {
    expect(moveItem(items, 3, 1)).toEqual(['a', 'd', 'b', 'c']);
  });

  it('clamps the target and ignores invalid sources', () => {
    expect(moveItem(items, 1, 99)).toEqual(['a', 'c', 'd', 'b']);
    expect(moveItem(items, 7, 0)).toEqual(items);
    expect(moveItem(items, 2, 2)).toEqual(items);
  });

  it('never mutates its input', () => {
    const copy = [...items];
    moveItem(items, 0, 3);
    expect(items).toEqual(copy);
  });
});

describe('toggleShowcase', () => {
  it('adds a card, then removes it', () => {
    const added = toggleShowcase([], ref('s1-001'));
    expect(added).toEqual({ showcase: [ref('s1-001')], result: 'added' });
    expect(toggleShowcase(added.showcase, ref('s1-001')).result).toBe('removed');
  });

  it('treats each finish of a card as a separate entry', () => {
    const { showcase } = toggleShowcase([ref('s1-001')], ref('s1-001', 'gold'));
    expect(showcase).toEqual([ref('s1-001'), ref('s1-001', 'gold')]);
  });

  it('refuses a seventh card', () => {
    const full = Array.from({ length: SHOWCASE_MAX }, (_, index) => ref(`s1-00${index}`));
    expect(toggleShowcase(full, ref('s1-099'))).toEqual({ showcase: full, result: 'full' });
  });
});

describe('slotAt', () => {
  const layout = { columns: 3, cellWidth: 100, cellHeight: 140, gap: 10, count: 6 };

  it('maps a point to its grid slot', () => {
    expect(slotAt(10, 10, layout)).toBe(0);
    expect(slotAt(230, 10, layout)).toBe(2);
    expect(slotAt(120, 160, layout)).toBe(4);
  });

  it('clamps points outside the grid to existing slots', () => {
    expect(slotAt(-50, -50, layout)).toBe(0);
    expect(slotAt(999, 999, layout)).toBe(5);
    expect(slotAt(999, 999, { ...layout, count: 4 })).toBe(3);
  });
});
