/**
 * Visual direction: "engraved banknote" (from the art pack). Ink black-navy grounds,
 * warm cream ink, antique gold for rims, hairlines and highlights, and a single
 * vermilion accent (the M wax seal) kept for the primary action. Rarity colors live
 * in rarity.ts and are reserved for card content, never for app chrome.
 */
export type ColorScheme = 'dark' | 'light';

export type ThemeColors = {
  background: string;
  surface: string;
  surfaceRaised: string;
  border: string;
  text: string;
  textMuted: string;
  accent: string;
  accentEdge: string;
  onAccent: string;
  /** Antique gold: frames, hairlines, focus and highlights (second brand color). */
  gold: string;
  /** Brighter gold for engraved highlights and active states. */
  goldBright: string;
  /** Dark gold for 3D edges under gold faces. */
  goldEdge: string;
  /** Fine gold hairline used around surfaces. */
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
  overlay: string;
  shadow: string;
};

const dark: ThemeColors = {
  background: '#0A0D14',
  surface: '#121620',
  surfaceRaised: '#1A1F2B',
  border: '#2A2E38',
  text: '#F1E8D4',
  textMuted: '#A59E8C',
  accent: '#F0532F',
  accentEdge: '#9C2A15',
  onAccent: '#0A0D14',
  gold: '#C9A227',
  goldBright: '#E7C766',
  goldEdge: '#6E5510',
  hairline: 'rgba(201, 162, 39, 0.38)',
  neutralButton: '#1A1F2B',
  neutralButtonEdge: '#07090E',
  appleButton: '#FFFFFF',
  appleButtonEdge: '#B9BCC6',
  onAppleButton: '#000000',
  success: '#3DD68C',
  successEdge: '#23955E',
  danger: '#FF6B6B',
  dangerEdge: '#B84444',
  onDanger: '#0A0D14',
  overlay: 'rgba(4, 5, 9, 0.76)',
  shadow: '#000000',
};

const light: ThemeColors = {
  background: '#F3ECDD',
  surface: '#FBF7EE',
  surfaceRaised: '#ECE3CF',
  border: '#D8CCB2',
  text: '#0E1118',
  textMuted: '#5B5446',
  accent: '#F04A2C',
  accentEdge: '#A8321C',
  onAccent: '#0E1118',
  gold: '#9A7A16',
  goldBright: '#C9A227',
  goldEdge: '#5E4A0E',
  hairline: 'rgba(154, 122, 22, 0.45)',
  neutralButton: '#FBF7EE',
  neutralButtonEdge: '#CDBF9F',
  appleButton: '#000000',
  appleButtonEdge: '#3A3A3C',
  onAppleButton: '#FFFFFF',
  success: '#1FAF6B',
  successEdge: '#13784A',
  danger: '#D93838',
  dangerEdge: '#8F2020',
  onDanger: '#FFFFFF',
  overlay: 'rgba(14, 17, 24, 0.5)',
  shadow: '#0E1118',
};

export const palettes: Record<ColorScheme, ThemeColors> = { dark, light };
