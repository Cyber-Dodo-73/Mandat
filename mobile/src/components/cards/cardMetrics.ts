/** Standard trading card ratio (63 × 88 mm). */
export const CARD_RATIO = 88 / 63;

/**
 * Every card is designed once, at this reference width, and every dimension is a fraction
 * of it: a 72 px thumb is an exact scaled replica of the 300 px hero card.
 */
export const CARD_REFERENCE_WIDTH = 300;

export type CardSize = 'thumb' | 'grid' | 'large' | 'hero';

export const CARD_WIDTHS: Record<CardSize, number> = {
  thumb: 72,
  grid: 108,
  large: 240,
  hero: 300,
};

export type CardMetrics = {
  width: number;
  height: number;
  /** width / reference width: multiply any reference value by it. */
  unit: number;
  /** Outer corner radius. */
  radius: number;
  /** Thickness of the rarity frame. */
  frame: number;
  /** Inner padding of the face. */
  padding: number;
  /**
   * Live behavior only (tilt, gyro, animated foil) and how much text the plates carry.
   * It never changes the composition: the boxes are the same at every width.
   */
  detail: 'minimal' | 'compact' | 'full';
};

/** Reference values at 300 px wide. */
export const CARD_REFERENCE = { radius: 18, frame: 9, padding: 10 } as const;

export function cardMetrics(size: CardSize, widthOverride?: number): CardMetrics {
  const width = widthOverride ?? CARD_WIDTHS[size];
  const unit = width / CARD_REFERENCE_WIDTH;
  return {
    width,
    height: width * CARD_RATIO,
    unit,
    radius: CARD_REFERENCE.radius * unit,
    frame: CARD_REFERENCE.frame * unit,
    padding: CARD_REFERENCE.padding * unit,
    detail: width < 100 ? 'minimal' : width < 200 ? 'compact' : 'full',
  };
}
