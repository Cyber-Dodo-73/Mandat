import { diffKeys, flattenKeys } from '../keyDiff';
import en from '../locales/en.json';
import fr from '../locales/fr.json';

describe('flattenKeys', () => {
  it('flattens nested keys and merges plural variants', () => {
    expect(flattenKeys({ a: { b: 'x', count_one: '1', count_other: 'n' }, c: 'y' })).toEqual([
      'a.b',
      'a.count',
      'a.count',
      'c',
    ]);
  });
});

describe('diffKeys', () => {
  it('reports missing and extra keys', () => {
    expect(diffKeys({ a: 'x', b: { c: 'y' } }, { a: 'x', d: 'z' })).toEqual({ missing: ['b.c'], extra: ['d'] });
  });

  it('accepts different plural forms between languages', () => {
    expect(diffKeys({ n_one: 'a', n_other: 'b' }, { n_one: 'a', n_many: 'c', n_other: 'b' })).toEqual({
      missing: [],
      extra: [],
    });
  });

  it('finds no difference between the shipped fr and en locales', () => {
    expect(diffKeys(fr, en)).toEqual({ missing: [], extra: [] });
  });
});
