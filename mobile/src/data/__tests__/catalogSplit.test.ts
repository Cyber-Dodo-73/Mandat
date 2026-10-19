import { getCard, getCardHistory } from '../catalog';
import { historyChunkOf, splitCatalog } from '../catalogSplit';
import raw from '../cards.season1.json';

describe('splitCatalog', () => {
  const catalog = {
    season: 1,
    cards: [
      { id: 'a', number: 1, name: 'A', story: { fr: 's', en: 's' }, timeline: [] },
      { id: 'b', number: 51, name: 'B', legacy: { fr: 'l', en: 'l' } },
      { id: 'c', number: 52, name: 'C' },
    ],
  };

  it('keeps card faces in the index and moves long-form fields to chunks', () => {
    const { index, chunks } = splitCatalog(catalog, 50);
    expect(index.season).toBe(1);
    expect(index.cards.map((card) => Object.keys(card).sort())).toEqual([
      ['id', 'name', 'number'],
      ['id', 'name', 'number'],
      ['id', 'name', 'number'],
    ]);
    expect(chunks).toEqual([{ a: { story: { fr: 's', en: 's' }, timeline: [] } }, { b: { legacy: { fr: 'l', en: 'l' } } }]);
  });

  it('maps collector numbers to chunks', () => {
    expect(historyChunkOf(1, 50)).toBe(0);
    expect(historyChunkOf(50, 50)).toBe(0);
    expect(historyChunkOf(51, 50)).toBe(1);
    expect(historyChunkOf(500, 50)).toBe(9);
    expect(historyChunkOf(0, 50)).toBe(0);
  });
});

describe('bundled catalog', () => {
  it('ships a light index without long-form fields', () => {
    const cards = (raw as unknown as { cards: Record<string, unknown>[] }).cards;
    for (const card of cards) {
      for (const field of ['story', 'highlights', 'legacy', 'timeline']) expect(card).not.toHaveProperty(field);
    }
  });

  it('loads a card history lazily from its chunk and caches it', () => {
    const first = getCard('s1-001');
    expect(first).toBeDefined();
    const history = getCardHistory('s1-001');
    expect(history?.story?.fr.length).toBeGreaterThan(0);
    expect(getCardHistory('s1-001')).toBe(history);
  });

  it('has nothing for an unknown card', () => {
    expect(getCardHistory('nope')).toBeUndefined();
  });
});
