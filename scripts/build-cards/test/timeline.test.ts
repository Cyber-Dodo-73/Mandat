import { describe, expect, it } from 'vitest';
import { buildTimeline, genderedFr, type RawFact, validateTimeline } from '../src/timeline.ts';

const L = (s: string) => ({ fr: s, en: s });
const labels: Record<string, ReturnType<typeof L>> = {
  Q90: L('Paris'),
  Q11: L('President of France'),
  Q12: L('Order of Merit'),
  Q13: L('Chief executive officer'),
  Q14: L('Consul'),
  Q142: L('France'),
};
const labelOf = (q: string) => labels[q];

describe('buildTimeline', () => {
  it('keeps birth and death, prefers home offices, sorts chronologically and caps', () => {
    const facts: RawFact[] = [
      { person: 'Q1', kind: 'birth', item: 'Q90', year: 1916, sitelinks: Number.MAX_SAFE_INTEGER },
      { person: 'Q1', kind: 'death', item: 'Q1', year: 1996, sitelinks: Number.MAX_SAFE_INTEGER },
      { person: 'Q1', kind: 'office', item: 'Q11', year: 1981, endYear: 1995, sitelinks: 5, jurisdictions: ['Q142'] },
      { person: 'Q1', kind: 'award', item: 'Q12', year: 1990, sitelinks: 80 },
      { person: 'Q1', kind: 'office', item: 'Q13', year: 1970, sitelinks: 0, jurisdictions: ['Q30'] },
    ];
    const t = buildTimeline('Q1', facts, labelOf, new Set(['Q142']), 3);
    expect(t.map((e) => e.kind)).toEqual(['birth', 'office', 'death']);
    expect(t[0]?.label.fr).toBe('Naissance à Paris');
    expect(t[1]).toMatchObject({ year: 1981, endYear: 1995, wikidataId: 'Q11' });
    expect(t[2]?.label).toEqual({ fr: 'Mort', en: 'Death' });
    expect(validateTimeline(t)).toEqual([]);
  });

  it('merges overlapping terms and folds a recurring office into two entries', () => {
    const facts: RawFact[] = [-63, -59, -55, -52, -48].map((year) => ({
      person: 'Q2', kind: 'office' as const, item: 'Q14', year, endYear: year + 1, sitelinks: 50, jurisdictions: ['Q142'],
    }));
    facts.push({ person: 'Q2', kind: 'office', item: 'Q14', year: -63, endYear: -60, sitelinks: 50, jurisdictions: ['Q142'] });
    const t = buildTimeline('Q2', facts, labelOf, new Set(['Q142']));
    expect(t).toHaveLength(2);
    expect(t[0]).toMatchObject({ year: -63, endYear: -60 });
    expect(t[1]).toMatchObject({ year: -59, endYear: -47 });
  });

  it('labels a country fallback place in parentheses', () => {
    const t = buildTimeline('Q3', [{ person: 'Q3', kind: 'birth', item: 'Q142', year: 1900, sitelinks: 1, countryPlace: true }], labelOf);
    expect(t[0]?.label).toEqual({ fr: 'Naissance (France)', en: 'Birth (France)' });
  });
});

describe('genderedFr', () => {
  it('keeps the form matching the person', () => {
    expect(genderedFr('président ou présidente de la République', false)).toBe('président de la République');
    expect(genderedFr('président ou présidente de la République', true)).toBe('présidente de la République');
    expect(genderedFr('premier ou première ministre', true)).toBe('première ministre');
    expect(genderedFr("roi ou reine d'Espagne", true)).toBe("reine d'Espagne");
    expect(genderedFr('Directeur général ou directrice générale', false)).toBe('Directeur général');
    expect(genderedFr('Ministre de la Guerre ou des Armées', false)).toBe('Ministre de la Guerre ou des Armées');
  });
});

describe('validateTimeline', () => {
  it('rejects bad entries', () => {
    const errors = validateTimeline([
      { year: 1990, kind: 'office', label: L('A'), wikidataId: 'Q1' },
      { year: 1980, endYear: 1970, kind: 'spell', label: { fr: '', en: 'x' }, wikidataId: 'nope' },
    ]);
    expect(errors.join('\n')).toMatch(/chronological/);
    expect(errors.join('\n')).toMatch(/endYear/);
    expect(errors.join('\n')).toMatch(/kind/);
    expect(errors.join('\n')).toMatch(/label/);
    expect(errors.join('\n')).toMatch(/wikidataId/);
    expect(validateTimeline(new Array(13).fill({ year: 1, kind: 'award', label: L('x'), wikidataId: 'Q1' }))[0]).toMatch(/13 entries/);
  });
});
