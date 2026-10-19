import { describe, expect, it } from 'vitest';
import { abilityIssues, validateLongForm } from '../src/content.ts';
import type { Rarity } from '../src/types.ts';

describe('abilityIssues', () => {
  const ctx = { rarity: 'rare' as Rarity, era: 'modern', continent: 'europe' };
  const ability = (effect: object, fr = '+2 en Stratégie.', en = '+2 Strategy.') => ({
    name: { fr: 'X', en: 'X' },
    description: { fr, en },
    effect,
  });

  it('rejects conditions that can never trigger', () => {
    const rarer = ability({ type: 'bonus', stat: 'strategy', amount: 2, condition: { kind: 'opponentRarityHigher' } });
    expect(abilityIssues(rarer, { ...ctx, rarity: 'mythic' })).toHaveLength(1);
    expect(abilityIssues(rarer, ctx)).toEqual([]);
    const domain = ability({ type: 'bonus', stat: 'strategy', amount: 2, condition: { kind: 'roundDomain', value: 'diplomacy' } });
    expect(abilityIssues(domain, ctx)[0]).toMatch(/never apply/);
    const anyStat = ability({ type: 'bonus', stat: 'any', amount: 2, condition: { kind: 'roundDomain', value: 'diplomacy' } });
    expect(abilityIssues(anyStat, ctx)).toEqual([]);
  });

  it('enforces "manche" and the minus sign', () => {
    const effect = { type: 'malus', stat: 'strategy', amount: 2, condition: { kind: 'round', value: 3 } };
    expect(abilityIssues(ability(effect, '-2 en Stratégie au round 3.', '-2 Strategy in round 3.'), ctx)).toHaveLength(3);
    expect(abilityIssues(ability(effect, '−2 en Stratégie à la manche 3.', '−2 Strategy in round 3.'), ctx)).toEqual([]);
  });
});

describe('validateLongForm', () => {
  const sentence = 'Il fait une chose importante en 1900 pour son pays et son peuple tout entier.';
  const story = Array.from({ length: 8 }, () => sentence).join(' ');

  it('accepts valid optional fields and nothing at all', () => {
    expect(validateLongForm({})).toEqual([]);
    expect(
      validateLongForm({
        story: { fr: story, en: story },
        highlights: { fr: ['a', 'b', 'c'], en: ['a', 'b', 'c'] },
        legacy: { fr: 'Une phrase.', en: 'One sentence.' },
      }),
    ).toEqual([]);
  });

  it('rejects short stories, unbalanced highlights and long legacies', () => {
    const errors = validateLongForm({
      story: { fr: 'Trop court.', en: story },
      highlights: { fr: ['a', 'b', 'c'], en: ['a', 'b'] },
      legacy: { fr: 'Un. Deux. Trois.', en: 'One.' },
    }).join('\n');
    expect(errors).toMatch(/story\.fr/);
    expect(errors).toMatch(/same number/);
    expect(errors).toMatch(/legacy\.fr/);
  });
});
