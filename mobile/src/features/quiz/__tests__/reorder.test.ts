import { dropIndex, moveItem } from '../reorder';

describe('moveItem', () => {
  it('moves an item down and up', () => {
    expect(moveItem(['a', 'b', 'c', 'd'], 0, 2)).toEqual(['b', 'c', 'a', 'd']);
    expect(moveItem(['a', 'b', 'c', 'd'], 3, 0)).toEqual(['d', 'a', 'b', 'c']);
  });

  it('clamps the target and ignores an invalid source', () => {
    expect(moveItem(['a', 'b'], 0, 9)).toEqual(['b', 'a']);
    expect(moveItem(['a', 'b'], 5, 0)).toEqual(['a', 'b']);
  });

  it('never mutates its input', () => {
    const items = ['a', 'b', 'c'];
    moveItem(items, 0, 2);
    expect(items).toEqual(['a', 'b', 'c']);
  });
});

describe('dropIndex', () => {
  it('rounds the travel to whole rows and clamps to the list', () => {
    expect(dropIndex(1, 70, 64, 4)).toBe(2);
    expect(dropIndex(1, -200, 64, 4)).toBe(0);
    expect(dropIndex(2, 20, 64, 4)).toBe(2);
    expect(dropIndex(0, 500, 64, 4)).toBe(3);
  });
});
