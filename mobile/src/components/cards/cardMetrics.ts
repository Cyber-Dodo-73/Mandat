/** Standard trading card ratio (63 × 88 mm). */
export const CARD_RATIO = 88 / 63;

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
  /** Outer corner radius, proportional so small cards keep the same silhouette. */
  radius: number;
  /** Thickness of the rarity frame. */
  frame: number;
  /** Inner padding of the face. */
  padding: number;
  /** Height of the artwork window. */
  artHeight: number;
  /** Which face details are legible at this size. */
  detail: 'minimal' | 'compact' | 'full';
};

export function cardMetrics(size: CardSize, widthOverride?: number): CardMetrics {
  const width = widthOverride ?? CARD_WIDTHS[size];
  const height = Math.round(width * CARD_RATIO);
  const detail = width < 90 ? 'minimal' : width < 200 ? 'compact' : 'full';
  const frame = Math.max(3, Math.round(width * 0.035));
  const padding = Math.max(3, Math.round(width * 0.04));
  const artShare = detail === 'full' ? 0.5 : detail === 'compact' ? 0.62 : 0.72;
  return {
    width,
    height,
    radius: Math.round(width * 0.06),
    frame,
    padding,
    artHeight: Math.round(height * artShare),
    detail,
  };
}
