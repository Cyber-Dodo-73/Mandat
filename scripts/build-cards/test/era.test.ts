import { describe, expect, it } from 'vitest';
import { eraOf } from '../src/era.ts';
import { toHistoricalYear } from '../src/wikidata.ts';

describe('eraOf', () => {
  it.each([
    [-356, 'antiquity'], // Alexander the Great
    [449, 'antiquity'],
    [450, 'medieval'],
    [1162, 'medieval'], // Genghis Khan
    [1449, 'medieval'],
    [1450, 'modern'],
    [1769, 'modern'], // Napoleon
    [1859, 'modern'],
    [1860, 'contemporary'],
    [1918, 'contemporary'], // Mandela
  ] as const)('%i → %s', (year, era) => {
    expect(eraOf(year)).toBe(era);
  });
});

describe('toHistoricalYear', () => {
  it('maps XSD years (0000 = 1 BCE) to historical years without a year zero', () => {
    expect(toHistoricalYear('-0099-07-12T00:00:00Z')).toBe(-100); // Julius Caesar
    expect(toHistoricalYear('0000-01-01T00:00:00Z')).toBe(-1);
    expect(toHistoricalYear('1918-07-18T00:00:00Z')).toBe(1918);
    expect(toHistoricalYear('garbage')).toBeNull();
  });
});
