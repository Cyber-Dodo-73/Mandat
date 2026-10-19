import { allCards } from '@/data/catalog';
import { portraitCredits, portraits } from '@/data/portraits';

import { creditRows, matchesCredit, portraitCreditFor } from '../credits';

describe('portrait credits', () => {
  it('has exactly one credit per bundled portrait, all for real cards', () => {
    const ids = new Set(allCards.map((card) => card.id));
    expect(portraitCredits).toHaveLength(Object.keys(portraits).length);
    for (const credit of portraitCredits) {
      expect(ids.has(credit.cardId)).toBe(true);
      expect(portraits[credit.cardId]).toBeDefined();
    }
  });

  it('requires attribution for every CC BY / CC BY-SA portrait', () => {
    for (const credit of portraitCredits.filter((c) => /^CC BY/i.test(c.license ?? ''))) {
      expect(credit.attributionRequired).toBe(true);
    }
  });

  it('returns nothing for a card without portrait', () => {
    const missing = allCards.find((card) => !portraits[card.id]);
    expect(missing).toBeDefined();
    expect(portraitCreditFor(missing!.id)).toBeUndefined();
  });

  it('lists rows in collector order with localized names', () => {
    const rows = creditRows('fr');
    expect(rows[0]!.number).toBeLessThan(rows[rows.length - 1]!.number);
    expect(rows.every((row) => row.displayName.length > 0)).toBe(true);
  });

  it('searches name, author and license ignoring case and accents', () => {
    const row = {
      ...portraitCredits[0]!,
      displayName: 'Élisabeth II',
      number: 2,
      artist: 'Studio Lafayette',
      license: 'CC BY-SA 4.0',
    };
    expect(matchesCredit(row, 'elisabeth')).toBe(true);
    expect(matchesCredit(row, 'LAFAYETTE')).toBe(true);
    expect(matchesCredit(row, 'by-sa')).toBe(true);
    expect(matchesCredit(row, 'napoleon')).toBe(false);
    expect(matchesCredit(row, '  ')).toBe(true);
  });
});
