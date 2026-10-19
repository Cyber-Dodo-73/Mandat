import { badgeFamily, cosmeticKey, resolveCosmetic, seedOf } from '../cosmetics';

jest.mock('../cosmetics.generated', () => ({
  avatarImages: { level_15: 42 },
  bannerImages: {},
  badgeImages: { streak: 7 },
}));

describe('resolveCosmetic', () => {
  it('uses the bundled image when the file exists', () => {
    expect(resolveCosmetic('avatar', 'avatar.level_15').image).toBe(42);
    expect(resolveCosmetic('badge', 'streak_30').image).toBe(7);
  });

  it('falls back to a procedural emblem when the image is missing', () => {
    const visual = resolveCosmetic('avatar', 'avatar.starter_2');
    expect(visual.image).toBeNull();
    expect(visual.icon).toBe('create');
    expect(visual.tier).toBe('starter');
  });

  it('ranks cosmetics by prestige', () => {
    expect(resolveCosmetic('avatar', 'avatar.level_5').tier).toBe('common');
    expect(resolveCosmetic('avatar', 'avatar.level_45').tier).toBe('rare');
    expect(resolveCosmetic('avatar', 'avatar.level_100').tier).toBe('gold');
    expect(resolveCosmetic('banner', 'banner.mythic').tier).toBe('prism');
    expect(resolveCosmetic('badge', 'rarity_legendary_5').tier).toBe('gold');
  });

  it('still renders unknown ids (season pass rewards of a future season)', () => {
    const visual = resolveCosmetic('avatar', 'avatar.s2_tier_10');
    expect(visual.image).toBeNull();
    expect(visual.icon).toBe('gift');
  });
});

describe('helpers', () => {
  it('strips the kind prefix only when present', () => {
    expect(cosmeticKey('banner', 'banner.level_10')).toBe('level_10');
    expect(cosmeticKey('avatar', 'level_10')).toBe('level_10');
  });

  it('maps achievement ids to their family, longest prefix first', () => {
    expect(badgeFamily('quiz_perfect_10')).toBe('quiz_perfect');
    expect(badgeFamily('quiz_50')).toBe('quiz');
    expect(badgeFamily('continent_africa_25')).toBe('continent');
    expect(badgeFamily('weather_1')).toBeNull();
  });

  it('gives stable seeds in [0, 1]', () => {
    expect(seedOf('avatar.level_15')).toBe(seedOf('avatar.level_15'));
    expect(seedOf('a')).toBeGreaterThanOrEqual(0);
    expect(seedOf('a')).toBeLessThanOrEqual(1);
  });
});
