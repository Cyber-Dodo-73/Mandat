/**
 * Visual direction: "arcade collector". A deep ink-navy base, warm paper text
 * and a single ballot-red accent. Rarity colors live in rarity.ts and are
 * reserved for card content, never for app chrome.
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
  background: '#0B0F1A',
  surface: '#141A2A',
  surfaceRaised: '#1C2438',
  border: '#283149',
  text: '#F4F1EA',
  textMuted: '#9AA3B8',
  accent: '#FF5A3C',
  accentEdge: '#B83A22',
  onAccent: '#0B0F1A',
  neutralButton: '#1C2438',
  neutralButtonEdge: '#0F1422',
  appleButton: '#FFFFFF',
  appleButtonEdge: '#B9BCC6',
  onAppleButton: '#000000',
  success: '#3DD68C',
  successEdge: '#23955E',
  danger: '#FF6B6B',
  dangerEdge: '#B84444',
  onDanger: '#0B0F1A',
  overlay: 'rgba(5, 7, 13, 0.72)',
  shadow: '#000000',
};

const light: ThemeColors = {
  background: '#F6F3EC',
  surface: '#FFFFFF',
  surfaceRaised: '#EFEAE0',
  border: '#DDD6C8',
  text: '#0B0F1A',
  textMuted: '#555D70',
  accent: '#F04A2C',
  accentEdge: '#A8321C',
  onAccent: '#0B0F1A',
  neutralButton: '#FFFFFF',
  neutralButtonEdge: '#D2CABA',
  appleButton: '#000000',
  appleButtonEdge: '#3A3A3C',
  onAppleButton: '#FFFFFF',
  success: '#1FAF6B',
  successEdge: '#13784A',
  danger: '#D93838',
  dangerEdge: '#8F2020',
  onDanger: '#FFFFFF',
  overlay: 'rgba(11, 15, 26, 0.48)',
  shadow: '#0B0F1A',
};

export const palettes: Record<ColorScheme, ThemeColors> = { dark, light };
