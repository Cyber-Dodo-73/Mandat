export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'mythic'] as const;

export type Rarity = (typeof RARITIES)[number];

export type RevealHaptic =
  | 'flipCommon'
  | 'flipUncommon'
  | 'flipRare'
  | 'flipEpic'
  | 'flipLegendary'
  | 'flipMythic';

export type RevealSound =
  | 'reveal_common'
  | 'reveal_uncommon'
  | 'reveal_rare'
  | 'reveal_epic'
  | 'reveal_legendary'
  | 'reveal_mythic';

export type RarityStyle = {
  /** Main color used for frames, badges and glows. */
  color: string;
  /** Darker edge used for 3D borders and frame insets. */
  edge: string;
  /** Gradient stops for frames. Mythic uses a full prism. */
  gradient: readonly [string, string, ...string[]];
  glow: { color: string; radius: number; opacity: number };
  /** Whether the frame shimmer animates (legendary, mythic). */
  animated: boolean;
  reveal: {
    /** Pause before the flip, in ms, to build suspense. */
    suspenseMs: number;
    /** Total length of the reveal sequence, in ms. */
    durationMs: number;
    flash: boolean;
    particles: number;
    dimBackground: boolean;
  };
  haptic: RevealHaptic;
  sound: RevealSound;
};

export const rarityStyles: Record<Rarity, RarityStyle> = {
  common: {
    color: '#B8C0CC',
    edge: '#7D8695',
    gradient: ['#D9DEE5', '#9AA3B0'],
    glow: { color: '#B8C0CC', radius: 8, opacity: 0.25 },
    animated: false,
    reveal: { suspenseMs: 0, durationMs: 350, flash: false, particles: 0, dimBackground: false },
    haptic: 'flipCommon',
    sound: 'reveal_common',
  },
  uncommon: {
    color: '#3DD68C',
    edge: '#1F8F58',
    gradient: ['#6BEBAE', '#1FAF6B'],
    glow: { color: '#3DD68C', radius: 10, opacity: 0.35 },
    animated: false,
    reveal: { suspenseMs: 0, durationMs: 400, flash: false, particles: 0, dimBackground: false },
    haptic: 'flipUncommon',
    sound: 'reveal_uncommon',
  },
  rare: {
    color: '#3D8BFF',
    edge: '#1F55B8',
    gradient: ['#7AB2FF', '#2F6FE0'],
    glow: { color: '#3D8BFF', radius: 16, opacity: 0.5 },
    animated: false,
    reveal: { suspenseMs: 150, durationMs: 700, flash: true, particles: 0, dimBackground: false },
    haptic: 'flipRare',
    sound: 'reveal_rare',
  },
  epic: {
    color: '#A855F7',
    edge: '#6B2BB0',
    gradient: ['#C98BFF', '#8B3DE8'],
    glow: { color: '#A855F7', radius: 22, opacity: 0.6 },
    animated: false,
    reveal: { suspenseMs: 600, durationMs: 1400, flash: true, particles: 40, dimBackground: false },
    haptic: 'flipEpic',
    sound: 'reveal_epic',
  },
  legendary: {
    color: '#FFC53D',
    edge: '#B8860B',
    gradient: ['#FFE38A', '#FFC53D', '#E39B12'],
    glow: { color: '#FFC53D', radius: 28, opacity: 0.75 },
    animated: true,
    reveal: { suspenseMs: 900, durationMs: 2400, flash: true, particles: 80, dimBackground: true },
    haptic: 'flipLegendary',
    sound: 'reveal_legendary',
  },
  mythic: {
    color: '#FF6BD6',
    edge: '#8B6CFF',
    gradient: ['#FF5A5A', '#FFB23D', '#F9F871', '#4BE38F', '#3DB7FF', '#8B6CFF', '#FF6BD6'],
    glow: { color: '#FFFFFF', radius: 36, opacity: 0.85 },
    animated: true,
    reveal: { suspenseMs: 1200, durationMs: 3800, flash: true, particles: 160, dimBackground: true },
    haptic: 'flipMythic',
    sound: 'reveal_mythic',
  },
};

export function rarityRank(rarity: Rarity): number {
  return RARITIES.indexOf(rarity);
}
