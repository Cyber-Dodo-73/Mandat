import { describe, expect, it } from 'vitest';
import { continentOfIso, resolveCandidatePlace, resolvePlace } from '../src/geo.ts';
import type { PlaceFacts } from '../src/wikidata.ts';
import { scored } from './helpers.ts';

const facts = new Map<string, PlaceFacts>([
  ['Q142', { qid: 'Q142', label: 'France', iso: 'FR', parentIsos: [], capitalIsos: ['FR'] }],
  ['Q2277', { qid: 'Q2277', label: 'Roman Empire', iso: null, parentIsos: [], capitalIsos: ['IT', 'TR', 'IT'] }],
  ['Q90', { qid: 'Q90', label: 'Paris', iso: null, parentIsos: ['FR'], capitalIsos: [] }],
  ['Q123', { qid: 'Q123', label: 'Kingdom of Hawaii', iso: null, parentIsos: [], capitalIsos: ['US'] }],
]);

describe('geo', () => {
  it('maps transcontinental countries by UN M49', () => {
    expect(continentOfIso('RU')).toBe('europe');
    expect(continentOfIso('TR')).toBe('asia');
    expect(continentOfIso('EG')).toBe('africa');
    expect(continentOfIso('MX')).toBe('north_america');
  });

  it('resolves own ISO, containing country and capital majority', () => {
    expect(resolvePlace('Q142', facts, {})).toEqual({ iso: 'FR', continent: 'europe' });
    expect(resolvePlace('Q90', facts, {})).toEqual({ iso: 'FR', continent: 'europe' });
    expect(resolvePlace('Q2277', facts, {})).toEqual({ iso: 'IT', continent: 'europe' });
  });

  it('applies historic-state overrides, including continent and ignore entries', () => {
    const overrides = {
      Q123: { name: 'Kingdom of Hawaii', iso: 'US', continent: 'oceania' as const },
      Q142: { name: 'France', iso: null },
    };
    expect(resolvePlace('Q123', facts, overrides)).toEqual({ iso: 'US', continent: 'oceania' });
    expect(resolvePlace('Q142', facts, overrides)).toBeNull();
  });

  it('picks the country with the most votes', () => {
    const resolve = (qid: string) => resolvePlace(qid, facts, {});
    const candidate = scored({ continent: 'europe', rawScore: 1, citizenshipQids: ['Q2277'], birthCountryQid: 'Q142' });
    expect(resolveCandidatePlace(candidate, resolve)?.iso).toBe('IT');
    const withPosition = {
      ...candidate,
      positions: [{ qid: 'Q1', label: { fr: 'x', en: 'x' }, sitelinks: 10, jurisdictionQid: 'Q90' }],
    };
    expect(resolveCandidatePlace(withPosition, resolve)?.iso).toBe('FR');
  });
});
