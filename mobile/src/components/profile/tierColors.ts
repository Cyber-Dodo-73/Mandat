import { GOLD } from '@/components/cards';
import type { CosmeticTier } from '@/features/profile/cosmetics';
import type { ThemeColors } from '@/theme';
import { rarityStyles } from '@/theme/rarity';

export type TierPaint = {
  /** Ring and engraving color. */
  line: string;
  /** Inner disc. */
  fill: string;
  /** Glyph color on the disc. */
  glyph: string;
  /** Sweep gradient for the outer ring, when the tier shimmers. */
  sweep: readonly string[] | null;
};

/** The fallback emblems reuse the app palette: paper, vermilion, gold, and the mythic prism. */
export function tierPaint(tier: CosmeticTier, colors: ThemeColors): TierPaint {
  switch (tier) {
    case 'starter':
      return { line: colors.textMuted, fill: colors.surfaceRaised, glyph: colors.text, sweep: null };
    case 'common':
      return { line: colors.accent, fill: colors.surfaceRaised, glyph: colors.text, sweep: null };
    case 'rare':
      return { line: colors.accent, fill: colors.surface, glyph: colors.accent, sweep: [colors.accent, GOLD.base, colors.accent] };
    case 'gold':
      return { line: GOLD.base, fill: colors.surface, glyph: GOLD.base, sweep: GOLD.gradient };
    case 'prism':
      return { line: rarityStyles.mythic.color, fill: colors.surface, glyph: colors.text, sweep: rarityStyles.mythic.gradient };
  }
}
