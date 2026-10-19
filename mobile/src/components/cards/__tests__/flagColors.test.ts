import { allCards } from '@/data/catalog';

import { flagPalette, hasFlagColors } from '../flagColors';

describe('flag palettes', () => {
  it('covers every country of the catalog', () => {
    const missing = [...new Set(allCards.map((card) => card.country))].filter((country) => !hasFlagColors(country));
    expect(missing).toEqual([]);
  });

  it('skips white for the artwork gradient but keeps it in the stripes', () => {
    const japan = flagPalette('JP', 'asia');
    expect(japan.primary).toBe('#BC002D');
    expect(japan.primary).not.toBe('#FFFFFF');
    expect(japan.secondary).not.toBe('#FFFFFF');
    expect(japan.stripes).toContain('#FFFFFF');
  });

  it('falls back to the continent palette for unknown codes', () => {
    const unknown = flagPalette('XX', 'oceania');
    expect(unknown.primary).toBe('#1F6E8C');
    expect(unknown.stripes).toHaveLength(2);
    expect(flagPalette('xx', 'africa').primary).toBe('#C8742E');
  });

  it('accepts lowercase codes', () => {
    expect(flagPalette('fr', 'europe')).toEqual(flagPalette('FR', 'europe'));
  });
});
