/**
 * Booster foil palettes. Like rarity colors, these are content art (printed on the
 * packs), never app chrome. The standard pack carries the app's ballot-red accent.
 */
export type PackTheme = 'standard' | 'africa' | 'asia' | 'europe' | 'north_america' | 'south_america' | 'oceania';

export type PackPalette = {
  /** Darkest foil tone: edges and guilloche shadows. */
  deep: string;
  /** Main foil color. */
  base: string;
  /** Highlights, guilloche lines and wordmark. */
  light: string;
  /** Soft glow behind the pack on the hub stage. */
  glow: string;
};

export const packPalettes: Record<PackTheme, PackPalette> = {
  standard: { deep: '#5C150B', base: '#E8472A', light: '#FFC2AE', glow: '#FF5A3C' },
  africa: { deep: '#5A2E06', base: '#D98A1F', light: '#FFE1A6', glow: '#F2A33A' },
  asia: { deep: '#55102B', base: '#D6386A', light: '#FFC0D3', glow: '#E83E73' },
  europe: { deep: '#102657', base: '#2F5FD9', light: '#BCD0FF', glow: '#3D6DFF' },
  north_america: { deep: '#073B3A', base: '#1FA898', light: '#BDF5EE', glow: '#2FC5B4' },
  south_america: { deep: '#183F12', base: '#4DA82F', light: '#D3F5BF', glow: '#62C93E' },
  oceania: { deep: '#08324F', base: '#1F8FCC', light: '#BDE9FF', glow: '#2BA8E8' },
};
