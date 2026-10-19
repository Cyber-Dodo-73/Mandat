import { allCards } from '@/data/catalog';
import { FLAG_SVGS } from '@/data/flags.generated';

describe('bundled flags', () => {
  it('has a real SVG flag for every country of the catalog', () => {
    const countries = [...new Set(allCards.map((card) => card.country.toUpperCase()))];
    for (const code of countries) {
      expect(FLAG_SVGS[code]).toMatch(/^<svg[\s\S]*<\/svg>$/);
    }
  });

  it('draws Uganda and Belgium differently (no generic tricolor)', () => {
    expect(FLAG_SVGS.UG).not.toEqual(FLAG_SVGS.BE);
  });
});
