import type { Continent, ScoredCandidate } from '../src/types.ts';

let seq = 0;

export function scored(partial: Partial<ScoredCandidate> & { continent: Continent; rawScore: number }): ScoredCandidate {
  seq++;
  return {
    qid: `Q${seq}`,
    name: { fr: `P${seq}`, en: `P${seq}` },
    sitelinks: 50,
    enwikiTitle: `P${seq}`,
    birthYear: 1900,
    deathYear: null,
    citizenshipQids: [],
    birthCountryQid: null,
    positions: [],
    occupationQids: [],
    categories: [],
    country: 'FR',
    era: 'contemporary',
    pageviews: 1000,
    fameScore: 0,
    ...partial,
  };
}
