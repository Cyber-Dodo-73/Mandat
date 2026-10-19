import { i18n, initI18n } from '@/i18n';

import type { Achievement, Mission } from '../api';
import { achievementLabel, loose, missionLabel, rewardParts } from '../labels';

const reward = { xp: 0, influence: 0, bonusPacks: 0, unlocks: [] };

const mission = (overrides: Partial<Mission>): Mission => ({
  id: 'm1',
  templateId: 'daily.open_2_packs',
  type: 'OPEN_PACKS',
  period: 'daily',
  progress: 0,
  target: 2,
  completed: false,
  claimed: false,
  reward,
  ...overrides,
});

describe('progression labels', () => {
  beforeAll(async () => {
    initI18n();
    await i18n.changeLanguage('fr');
  });

  const t = () => loose(i18n.t.bind(i18n));

  it('builds mission wordings from the type, target and continent', () => {
    expect(missionLabel(t(), mission({}))).toBe('Ouvre 2 boosters');
    expect(missionLabel(t(), mission({ type: 'NEW_CARDS_FROM_CONTINENT', param: 'africa', target: 1 }))).toBe(
      'Obtiens 1 nouvelle carte · Afrique',
    );
  });

  it('falls back to the template id for unknown mission types', () => {
    expect(missionLabel(t(), mission({ type: 'FUTURE_TYPE', templateId: 'daily.future' }))).toBe('daily.future');
  });

  it('labels achievements with their localized param', () => {
    const achievement: Achievement = {
      id: 'era_antiquity_5',
      category: 'eras',
      metric: 'CARDS_FROM_ERA',
      param: 'antiquity',
      threshold: 5,
      progress: 2,
      reward,
    };
    expect(achievementLabel(t(), achievement)).toBe('5 cartes · Antiquité');
  });

  it('lists reward parts in order', () => {
    expect(rewardParts(t(), { xp: 50, influence: 20, bonusPacks: 1, unlocks: [{ kind: 'title', itemId: 'title.diplomat' }] })).toEqual([
      '+50 XP',
      '+20 Influence',
      '+1 booster',
      'Nouveau titre',
    ]);
  });
});
