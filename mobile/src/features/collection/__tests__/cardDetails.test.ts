import { allCards } from '@/data/catalog';
import type { Card } from '@/types/card';

import { cardDetails, highlightIcon, timelineSpan } from '../cardDetails';

const bc = (year: number) => (year < 0 ? `${-year} av. J.-C.` : String(year));

const base: Card = {
  ...allCards[0]!,
  bio: { fr: 'Bio FR', en: 'Bio EN' },
  story: { fr: 'Histoire FR', en: '' },
  highlights: { fr: ['Un', 'Deux', 'Trois'], en: [] },
  legacy: { fr: 'Héritage', en: 'Legacy' },
  timeline: [
    { year: -69, kind: 'birth', label: { fr: 'Naissance à Alexandrie', en: 'Born in Alexandria' } },
    { year: -51, endYear: -30, kind: 'office', label: { fr: "Reine d'Égypte", en: 'Queen of Egypt' } },
    { year: -30, kind: 'death', label: { fr: 'Décès', en: '' } },
  ],
};

describe('cardDetails', () => {
  it('uses the requested language and falls back to French piece by piece', () => {
    const details = cardDetails(base, 'en', bc);
    expect(details.bio).toBe('Bio EN');
    expect(details.story).toBe('Histoire FR');
    expect(details.highlights).toEqual(['Un', 'Deux', 'Trois']);
    expect(details.legacy).toBe('Legacy');
    expect(details.timeline[2]!.label).toBe('Décès');
  });

  it('formats BC years and spans in the timeline', () => {
    const rows = cardDetails(base, 'fr', bc).timeline;
    expect(rows.map((row) => row.when)).toEqual(['69 av. J.-C.', '51 av. J.-C. – 30 av. J.-C.', '30 av. J.-C.']);
    expect(rows.map((row) => row.kind)).toEqual(['birth', 'office', 'death']);
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it('handles cards without long-form content', () => {
    const { story, highlights, legacy, timeline, ...rest } = base;
    void story;
    void highlights;
    void legacy;
    void timeline;
    const details = cardDetails(rest, 'fr');
    expect(details).toEqual({ bio: 'Bio FR', story: null, highlights: [], legacy: null, timeline: [] });
  });

  it('has history for every card of the season, with matching highlight counts', () => {
    for (const card of allCards) {
      const fr = cardDetails(card, 'fr');
      const en = cardDetails(card, 'en');
      expect(fr.story).not.toBeNull();
      expect(fr.highlights.length).toBeGreaterThanOrEqual(3);
      expect(fr.highlights.length).toBeLessThanOrEqual(5);
      expect(en.highlights).toHaveLength(fr.highlights.length);
      expect(fr.timeline.length).toBeGreaterThan(0);
    }
  });
});

describe('timelineSpan', () => {
  it('shows a single year when the span stays within it', () => {
    expect(timelineSpan({ year: 1981 }, String)).toBe('1981');
    expect(timelineSpan({ year: 1981, endYear: 1981 }, String)).toBe('1981');
    expect(timelineSpan({ year: 1981, endYear: 1995 }, String)).toBe('1981 – 1995');
  });
});

describe('highlightIcon', () => {
  it('spots awards and offices', () => {
    expect(highlightIcon('Prix Nobel de la paix en 1993')).toBe('trophy-outline');
    expect(highlightIcon('Élu président en 1994')).toBe('flag-outline');
    expect(highlightIcon('Elected president in 1994')).toBe('flag-outline');
    expect(highlightIcon('Passe 27 ans en prison')).toBe('star-outline');
  });
});
