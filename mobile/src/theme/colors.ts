/**
 * Visual direction: a premium collectible game (Ultimate Team / TCG Pocket, grown-up).
 * Deep ink navy ground with a soft radial light, antique gold as the brand color for
 * accents, frames and active states, vermilion only for the main call to action, cream
 * headings and cool grey secondary text. Rarity jewel tones live in rarity.ts.
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
  /** Antique gold: selection, progress, active states, frames. */
  brand: string;
  brandEdge: string;
  onBrand: string;
  /** Vermilion: the primary call to action only. */
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
  background: '#0B0F1A',
  backgroundGlow: '#1B2440',
  surface: '#141A29',
  surfaceRaised: '#1C2335',
  border: '#2A3247',
  text: '#F1E8D4',
  textMuted: '#9AA2B4',
  brand: '#C9A227',
  brandEdge: '#8A6C12',
  onBrand: '#0B0F1A',
  accent: '#FF5A3C',
  accentEdge: '#B23A22',
  onAccent: '#0B0F1A',
  gold: '#C9A227',
  goldBright: '#E8C55A',
  goldEdge: '#8A6C12',
  hairline: 'rgba(201, 162, 39, 0.22)',
  neutralButton: '#1F2739',
  neutralButtonEdge: '#0E131F',
  appleButton: '#FFFFFF',
  appleButtonEdge: '#B9BCC6',
  onAppleButton: '#000000',
  success: '#3CB77A',
  successEdge: '#23794F',
  danger: '#E5484D',
  dangerEdge: '#9E2A2E',
  onDanger: '#FFFFFF',
  flame: '#FF8A3D',
  overlay: 'rgba(5, 8, 14, 0.88)',
  shadow: '#000000',
};

const light: ThemeColors = {
  background: '#F3EEE3',
  backgroundGlow: '#FFFBF2',
  surface: '#FFFCF6',
  surfaceRaised: '#ECE5D6',
  border: '#D8CDB6',
  text: '#12172A',
  textMuted: '#5B6275',
  brand: '#93720F',
  brandEdge: '#5E4808',
  onBrand: '#FFFCF6',
  accent: '#E5482B',
  accentEdge: '#9E2E19',
  onAccent: '#FFFFFF',
  gold: '#A9840F',
  goldBright: '#C9A227',
  goldEdge: '#6E560A',
  hairline: 'rgba(147, 114, 15, 0.25)',
  neutralButton: '#FFFCF6',
  neutralButtonEdge: '#CFC3A8',
  appleButton: '#000000',
  appleButtonEdge: '#3A3A3C',
  onAppleButton: '#FFFFFF',
  success: '#23935C',
  successEdge: '#16633D',
  danger: '#C8343A',
  dangerEdge: '#8A2024',
  onDanger: '#FFFFFF',
  flame: '#E86A1C',
  overlay: 'rgba(18, 23, 42, 0.6)',
  shadow: '#3A2E12',
};

export const palettes: Record<ColorScheme, ThemeColors> = { dark, light };
