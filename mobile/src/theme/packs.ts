/**
 * Booster foil palettes, from the art pack: every booster is black foil engraved in
 * antique gold with gold crimps and a star seal; each continent pack adds its own
 * accent (seal ring and stage glow). The standard pack carries the vermilion seal.
 * Like rarity colors, these are content art printed on the packs, never app chrome.
 */
export type PackTheme = 'standard' | 'africa' | 'asia' | 'europe' | 'north_america' | 'south_america' | 'oceania';

export type PackPalette = {
  /** Darkest foil tone: edges and guilloche shadows. */
  deep: string;
  /** Main foil color. */
  base: string;
  /** Engraving, crimps and wordmark (antique gold). */
  light: string;
  /** Continent accent: seal ring and printed details. */
  accent: string;
  /** Soft glow behind the pack on the hub stage. */
  glow: string;
};

const BLACK_FOIL = { deep: '#05070B', base: '#1A1E29', light: '#D4B04A' } as const;

export const packPalettes: Record<PackTheme, PackPalette> = {
  standard: { ...BLACK_FOIL, accent: '#F0532F', glow: '#E7C766' },
  africa: { ...BLACK_FOIL, accent: '#E39A2B', glow: '#E39A2B' },
  asia: { ...BLACK_FOIL, accent: '#E2466F', glow: '#E2466F' },
  europe: { ...BLACK_FOIL, accent: '#4A79F0', glow: '#4A79F0' },
  north_america: { ...BLACK_FOIL, accent: '#2BBFAE', glow: '#2BBFAE' },
  south_america: { ...BLACK_FOIL, accent: '#5CC23F', glow: '#5CC23F' },
  oceania: { ...BLACK_FOIL, accent: '#2FA6E3', glow: '#2FA6E3' },
};
