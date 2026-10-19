import { FALLBACK_RULES, craftCostPreview, holoUpgradeCostPreview } from '../economy';

describe('holo upgrade preview', () => {
  it('costs twice the craft cost of the rarity (server rule mirrored offline)', () => {
    for (const { rarity } of FALLBACK_RULES.rarities) {
      expect(holoUpgradeCostPreview(FALLBACK_RULES, rarity)).toBe(2 * craftCostPreview(FALLBACK_RULES, rarity));
    }
  });

  it('follows the server value when it changes', () => {
    const rules = {
      ...FALLBACK_RULES,
      rarities: FALLBACK_RULES.rarities.map((entry) => (entry.rarity === 'rare' ? { ...entry, holoUpgradeCost: 1234 } : entry)),
    };
    expect(holoUpgradeCostPreview(rules, 'rare')).toBe(1234);
  });
});
