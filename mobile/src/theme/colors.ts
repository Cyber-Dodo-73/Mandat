/**
 * Visual direction: a bright mobile collectible game (Duolingo x TCG Pocket x Ultimate Team).
 * Deep indigo game ground with a radial light, electric blue as the brand color, a hot
 * orange for the main call to action, green for success, gold only for rewards and
 * legendary content. Rarity colors live in rarity.ts and stay on card content.
 */
export type ColorScheme = 'dark' | 'light';

export type ThemeColors = {
  background: string;
  /** Centre of the radial light behind screens (gives the ground some depth). */
  backgroundGlow: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  /** Electric blue: selection, progress, links, secondary emphasis. */
  brand: string;
  brandEdge: string;
  onBrand: string;
  /** Hot orange: the primary call to action only. */
  accent: string;
  accentEdge: string;
  onAccent: string;
  /** Reward gold: Influence, rewards, legendary, premium. */
  gold: string;
  goldBright: string;
  goldEdge: string;
  /** Neutral separator, used sparingly. */
  hairline: string;
  neutralButton: string;
  neutralButtonEdge: string;
  /** Sign in with Apple: pure white on dark themes, pure black on light ones (Apple HIG). */
  appleButton: string;
  appleButtonEdge: string;
  onAppleButton: string;
  success: string;
  successEdge: string;
  danger: string;
  dangerEdge: string;
  onDanger: string;
  /** Streak flame. */
  flame: string;
  overlay: string;
  shadow: string;
};

const dark: ThemeColors = {
  background: '#0C1033',
  backgroundGlow: '#24317E',
  surface: '#171E4E',
  surfaceRaised: '#222B66',
  border: '#2E3A80',
  text: '#F7F8FF',
  textMuted: '#A9B2E2',
  brand: '#3B82FF',
  brandEdge: '#1D4FC4',
  onBrand: '#FFFFFF',
  accent: '#F25A13',
  accentEdge: '#A93A05',
  onAccent: '#FFFFFF',
  gold: '#FFC83D',
  goldBright: '#FFE27A',
  goldEdge: '#C68800',
  hairline: 'rgba(255, 255, 255, 0.08)',
  neutralButton: '#26306F',
  neutralButtonEdge: '#121845',
  appleButton: '#FFFFFF',
  appleButtonEdge: '#B9BCC6',
  onAppleButton: '#000000',
  success: '#2FCB74',
  successEdge: '#1A8E4D',
  danger: '#FF4D67',
  dangerEdge: '#B4263D',
  onDanger: '#FFFFFF',
  flame: '#FF8A1F',
  overlay: 'rgba(5, 7, 26, 0.86)',
  shadow: '#03051A',
};

const light: ThemeColors = {
  background: '#E9EFFF',
  backgroundGlow: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceRaised: '#F1F4FF',
  border: '#D3DCF6',
  text: '#131A40',
  textMuted: '#58628F',
  brand: '#2163F2',
  brandEdge: '#1544AE',
  onBrand: '#FFFFFF',
  accent: '#EE5410',
  accentEdge: '#A93A05',
  onAccent: '#FFFFFF',
  gold: '#E7A400',
  goldBright: '#FFC83D',
  goldEdge: '#A36F00',
  hairline: 'rgba(19, 26, 64, 0.08)',
  neutralButton: '#FFFFFF',
  neutralButtonEdge: '#C7D1EF',
  appleButton: '#000000',
  appleButtonEdge: '#3A3A3C',
  onAppleButton: '#FFFFFF',
  success: '#1FB463',
  successEdge: '#137A42',
  danger: '#E33452',
  dangerEdge: '#9C1E33',
  onDanger: '#FFFFFF',
  flame: '#FF7A0A',
  overlay: 'rgba(19, 26, 64, 0.6)',
  shadow: '#1B2766',
};

export const palettes: Record<ColorScheme, ThemeColors> = { dark, light };
