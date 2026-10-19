import { allCards } from '@/data/catalog';

import { cardText, formatCollectorNumber, localize, monogram } from '../cardText';

describe('card text helpers', () => {
  it('pads collector numbers to the season size', () => {
    expect(formatCollectorNumber(42, 500)).toBe('042/500');
    expect(formatCollectorNumber(7, 60)).toBe('07/60');
    expect(formatCollectorNumber(500, 500)).toBe('500/500');
  });

  it('builds monograms from first and last significant words', () => {
    expect(monogram('Nelson Mandela')).toBe('NM');
    expect(monogram('Cléopâtre')).toBe('C');
    expect(monogram('Charles de Gaulle')).toBe('CG');
    expect(monogram('Élisabeth II')).toBe('É');
    expect(monogram('Martin Luther King Jr.')).toBe('MK');
  });

  it('localizes with a French fallback', () => {
    expect(localize({ fr: 'Roi', en: 'King' }, 'en')).toBe('King');
    expect(localize({ fr: 'Roi', en: '' }, 'en')).toBe('Roi');
  });

  it('formats lifespans, including BC years', () => {
    const card = { ...allCards[0]!, birthYear: -69, deathYear: -30 };
    const text = cardText(card, 'fr', (year) => (year < 0 ? `${-year} av. J.-C.` : String(year)));
    expect(text.lifespan).toBe('69 av. J.-C. – 30 av. J.-C.');
    const living = cardText({ ...allCards[0]!, birthYear: 1946, deathYear: null }, 'en');
    expect(living.lifespan).toBe('1946');
  });
});
