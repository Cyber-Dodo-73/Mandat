import type { IconName } from '@/components/ui';

import { avatarImages, badgeImages, bannerImages } from './cosmetics.generated';

export type CosmeticKind = 'avatar' | 'banner' | 'badge';

/** How prestigious a cosmetic is: drives the fallback's metal (paper, vermilion, gold, prism). */
export type CosmeticTier = 'starter' | 'common' | 'rare' | 'gold' | 'prism';

export type CosmeticVisual = {
  id: string;
  kind: CosmeticKind;
  /** Bundled artwork when the file exists (see docs/ART_PROMPTS.md). */
  image: number | null;
  /** Procedural fallback, always available. */
  icon: IconName;
  tier: CosmeticTier;
  /** Stable 0–1 value derived from the id, to vary the fallback pattern. */
  seed: number;
};

export const DEFAULT_AVATAR = 'avatar.starter_1';
export const DEFAULT_BANNER = 'banner.default';

const PREFIX: Record<CosmeticKind, string> = { avatar: 'avatar.', banner: 'banner.', badge: '' };

/** Subjects of docs/ART_PROMPTS.md, translated into the closest Ionicons glyph. */
const AVATAR_ICONS: Record<string, IconName> = {
  starter_1: 'book',
  starter_2: 'create',
  starter_3: 'globe',
  starter_4: 'leaf',
  level_5: 'archive',
  level_10: 'hammer',
  level_15: 'business',
  level_20: 'compass',
  level_25: 'extension-puzzle',
  level_30: 'ribbon',
  level_35: 'boat',
  level_40: 'hourglass',
  level_45: 'shield',
  level_50: 'flashlight',
  level_55: 'podium',
  level_60: 'pencil',
  level_65: 'mail',
  level_70: 'planet',
  level_75: 'diamond',
  level_80: 'flame',
  level_85: 'library',
  level_90: 'eye',
  level_95: 'key',
  level_100: 'sunny',
  mythic: 'sparkles',
};

const BANNER_ICONS: Record<string, IconName> = {
  default: 'globe-outline',
  level_10: 'business-outline',
  level_20: 'map-outline',
  level_30: 'moon-outline',
  level_40: 'library-outline',
  level_50: 'document-text-outline',
  level_60: 'sunny-outline',
  level_70: 'grid-outline',
  level_80: 'thunderstorm-outline',
  level_90: 'cloud-outline',
  level_100: 'sunny',
  mythic: 'sparkles-outline',
  complete_season_1: 'trophy-outline',
};

/** Achievement families, matched by id prefix (longest first). */
export const BADGE_FAMILIES = [
  'quiz_perfect',
  'rarity_rare',
  'rarity_epic',
  'rarity_legendary',
  'rarity_mythic',
  'finish_holo',
  'finish_full_art',
  'finish_gold',
  'collection',
  'continent',
  'recycle',
  'streak',
  'packs',
  'level',
  'craft',
  'duel',
  'quiz',
  'era',
] as const;

export type BadgeFamily = (typeof BADGE_FAMILIES)[number];

const BADGE_ICONS: Record<BadgeFamily, IconName> = {
  quiz_perfect: 'star',
  rarity_rare: 'diamond-outline',
  rarity_epic: 'diamond',
  rarity_legendary: 'trophy',
  rarity_mythic: 'sparkles',
  finish_holo: 'color-wand',
  finish_full_art: 'image',
  finish_gold: 'medal',
  collection: 'albums',
  continent: 'earth',
  recycle: 'repeat',
  streak: 'flame',
  packs: 'gift',
  level: 'trending-up',
  craft: 'construct',
  duel: 'flash',
  quiz: 'help-circle',
  era: 'hourglass',
};

const BADGE_TIERS: Partial<Record<BadgeFamily, CosmeticTier>> = {
  rarity_legendary: 'gold',
  finish_gold: 'gold',
  rarity_mythic: 'prism',
  finish_holo: 'rare',
  finish_full_art: 'rare',
  rarity_epic: 'rare',
};

/** Family of an achievement id (`rarity_mythic_3` → `rarity_mythic`), or null if unknown. */
export function badgeFamily(achievementId: string): BadgeFamily | null {
  return BADGE_FAMILIES.find((family) => achievementId === family || achievementId.startsWith(`${family}_`)) ?? null;
}

/** `avatar.level_15` → `level_15`; ids without the expected prefix are kept as is. */
export function cosmeticKey(kind: CosmeticKind, id: string): string {
  const prefix = PREFIX[kind];
  return prefix && id.startsWith(prefix) ? id.slice(prefix.length) : id;
}

/** Deterministic 0–1 hash of an id (FNV-1a), so a fallback always looks the same. */
export function seedOf(id: string): number {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0) / 0xffffffff;
}

function levelTier(key: string): CosmeticTier {
  if (key.startsWith('starter') || key === 'default') return 'starter';
  if (key === 'mythic' || key === 'complete_season_1') return 'prism';
  const level = Number(/level_(\d+)/.exec(key)?.[1] ?? NaN);
  if (Number.isFinite(level)) {
    if (level >= 75) return 'gold';
    if (level >= 40) return 'rare';
    return 'common';
  }
  return key.includes('tier') ? 'rare' : 'common';
}

/** Image when bundled, procedural description otherwise. */
export function resolveCosmetic(kind: CosmeticKind, id: string): CosmeticVisual {
  const key = cosmeticKey(kind, id);
  if (kind === 'badge') {
    const family = badgeFamily(key);
    return {
      id,
      kind,
      image: (family && badgeImages[family]) || null,
      icon: family ? BADGE_ICONS[family] : 'ribbon',
      tier: (family && BADGE_TIERS[family]) || 'common',
      seed: seedOf(family ?? key),
    };
  }
  const images = kind === 'avatar' ? avatarImages : bannerImages;
  const icons = kind === 'avatar' ? AVATAR_ICONS : BANNER_ICONS;
  const seasonIcon: IconName = kind === 'avatar' ? 'gift' : 'layers-outline';
  return {
    id,
    kind,
    image: images[key] ?? null,
    icon: icons[key] ?? (key.includes('_tier_') ? seasonIcon : kind === 'avatar' ? 'person' : 'flag-outline'),
    tier: levelTier(key),
    seed: seedOf(key),
  };
}
