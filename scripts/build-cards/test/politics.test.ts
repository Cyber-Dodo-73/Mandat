import { describe, expect, it } from 'vitest';
import { exclusionReason, type Exclusions } from '../src/politics.ts';
import type { Position } from '../src/types.ts';
import { scored } from './helpers.ts';

const rules: Exclusions = {
  nonPoliticalOccupations: { Q1028181: 'painter', Q49757: 'poet' },
  strongCategories: ['revolutionary'],
  leadershipCategories: ['head_of_state'],
  sovereignPositions: { Q81066: 'United Nations Secretary-General' },
  notablePositionMinSitelinks: 30,
  alwaysExcludedOccupations: { Q11900058: 'explorer' },
  positions: { Q19546: { name: 'Pope', reason: 'religious office' } },
  people: { Q9458: { name: 'Muhammad', reason: 'religious founder' } },
};
const SOVEREIGN = new Set(['Q30', 'Q145', 'Q1747689']);
const isSovereign = (qid: string) => SOVEREIGN.has(qid);
const pos = (qid: string, sitelinks: number, jurisdictionQid: string | null): Position => ({
  qid,
  label: { fr: qid, en: qid },
  sitelinks,
  jurisdictionQid,
});
const check = (partial: Parameters<typeof scored>[0]) => exclusionReason(scored(partial), rules, isSovereign);

describe('exclusionReason', () => {
  it('keeps plain political figures', () => {
    expect(check({ continent: 'europe', rawScore: 1, occupationQids: ['Q82955'] })).toBeNull();
  });

  it('excludes artists who only held minor offices', () => {
    const byron = { continent: 'europe' as const, rawScore: 1, occupationQids: ['Q49757'], categories: ['politician'] };
    expect(check({ ...byron, positions: [pos('Q1', 4, 'Q145')] })).toMatch(/poet/);
    // A small-town mayor is a head of government, but the jurisdiction is not sovereign.
    expect(check({ ...byron, categories: ['head_of_state'], positions: [pos('Q2', 0, 'Q-city')] })).toMatch(/poet/);
  });

  it('keeps leaders, notable office holders and strong categories despite noisy occupations', () => {
    const base = { continent: 'europe' as const, rawScore: 1, occupationQids: ['Q49757'] };
    expect(check({ ...base, categories: ['head_of_state'], positions: [pos('Q3', 6, 'Q145')] })).toBeNull(); // Charles III
    expect(check({ ...base, categories: ['politician'], positions: [pos('Q4', 75, 'Q1747689')] })).toBeNull(); // Caesar
    expect(check({ ...base, categories: ['politician'], positions: [pos('Q81066', 92, null)] })).toBeNull(); // UN SG
    expect(check({ ...base, categories: ['revolutionary'] })).toBeNull(); // Marx
  });

  it('excludes explorers unless they held a notable sovereign office', () => {
    const explorer = { continent: 'europe' as const, rawScore: 1, occupationQids: ['Q11900058'], categories: ['head_of_state'] };
    expect(check({ ...explorer, positions: [pos('Q5', 0, 'Q30')] })).toMatch(/explorer/); // Columbus
    expect(check({ ...explorer, positions: [pos('Q11696', 144, 'Q30')] })).toBeNull(); // Theodore Roosevelt
  });

  it('always excludes listed positions and people', () => {
    expect(check({ continent: 'europe', rawScore: 1, positions: [pos('Q19546', 200, null)] })).toMatch(/religious office/);
    expect(check({ continent: 'asia', rawScore: 1, qid: 'Q9458' })).toMatch(/religious founder/);
  });
});
