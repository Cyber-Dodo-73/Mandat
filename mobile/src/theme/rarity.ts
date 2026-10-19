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
    color: '#AEB6C2',
    edge: '#6F7785',
    gradient: ['#D3D8DF', '#8F98A6'],
    glow: { color: '#AEB6C2', radius: 8, opacity: 0.25 },
    animated: false,
    reveal: { suspenseMs: 0, durationMs: 350, flash: false, particles: 0, dimBackground: false },
    haptic: 'flipCommon',
    sound: 'reveal_common',
  },
  uncommon: {
    color: '#2FAE73',
    edge: '#1B6E48',
    gradient: ['#5CCB97', '#1E8C59'],
    glow: { color: '#2FAE73', radius: 10, opacity: 0.35 },
    animated: false,
    reveal: { suspenseMs: 0, durationMs: 400, flash: false, particles: 0, dimBackground: false },
    haptic: 'flipUncommon',
    sound: 'reveal_uncommon',
  },
  rare: {
    color: '#3F74D8',
    edge: '#22478F',
    gradient: ['#6E9BEA', '#2D5BB8'],
    glow: { color: '#3F74D8', radius: 16, opacity: 0.5 },
    animated: false,
    reveal: { suspenseMs: 150, durationMs: 700, flash: true, particles: 0, dimBackground: false },
    haptic: 'flipRare',
    sound: 'reveal_rare',
  },
  epic: {
    color: '#9257D6',
    edge: '#5C2F94',
    gradient: ['#B588E8', '#7440BC'],
    glow: { color: '#9257D6', radius: 22, opacity: 0.6 },
    animated: false,
    reveal: { suspenseMs: 600, durationMs: 1400, flash: true, particles: 40, dimBackground: false },
    haptic: 'flipEpic',
    sound: 'reveal_epic',
  },
  legendary: {
    color: '#D6A936',
    edge: '#8A6C12',
    gradient: ['#F0D27A', '#D6A936', '#A57E16'],
    glow: { color: '#D6A936', radius: 28, opacity: 0.75 },
    animated: true,
    reveal: { suspenseMs: 900, durationMs: 2400, flash: true, particles: 80, dimBackground: true },
    haptic: 'flipLegendary',
    sound: 'reveal_legendary',
  },
  mythic: {
    color: '#E07AC8',
    edge: '#7E66D6',
    gradient: ['#E86A6A', '#E9AE4A', '#E6E07A', '#5CC98F', '#4FA7E0', '#8A74E0', '#E07AC8'],
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
