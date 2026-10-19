import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { Emblem } from '@/components/brand/Brand';
import { seasonSize } from '@/data/catalog';
import { formatCollectorNumber } from '@/features/collection/cardText';
import { useTranslation } from '@/i18n';
import { fontFamilies } from '@/theme';
import { palettes } from '@/theme/colors';
import { rarityStyles } from '@/theme/rarity';
import type { Card } from '@/types/card';

import { cardMetrics, type CardSize } from './cardMetrics';

type CardSilhouetteProps = {
  card: Card;
  size?: CardSize;
  width?: number;
};

/**
 * A card the player does not own yet: a sealed card back, proportional to its width, with the
 * dimmed emblem, a small rarity gem and the collector number only. Who is missing stays a mystery
 * until the card is pulled (no name, country or portrait).
 */
export const CardSilhouette = memo(function CardSilhouette({ card, size = 'grid', width }: CardSilhouetteProps) {
  const { t } = useTranslation();
  const metrics = cardMetrics(size, width);
  const { width: w, height: h, radius, unit } = metrics;
  const colors = palettes.dark;
  const rarity = rarityStyles[card.rarity];
  const inset = metrics.frame;
  const gem = 12 * unit;

  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('cards.silhouetteA11y', { number: card.number })}
      style={[styles.slot, { width: w, height: h, borderRadius: radius, backgroundColor: colors.surface }]}
    >
      <View
        style={[
          styles.inner,
          {
            top: inset,
            left: inset,
            right: inset,
            bottom: inset,
            borderRadius: radius * 0.7,
            borderWidth: Math.max(1, 1.5 * unit),
            borderColor: `${colors.gold}40`,
            backgroundColor: colors.background,
          },
        ]}
      />
      <Emblem size={w * 0.42} style={styles.emblem} />
      <View
        style={[
          styles.gem,
          {
            top: inset + 10 * unit,
            right: inset + 10 * unit,
            width: gem,
            height: gem,
            borderRadius: 2 * unit,
            backgroundColor: `${rarity.color}B3`,
          },
        ]}
      />
      <Text
        allowFontScaling={false}
        numberOfLines={1}
        style={[styles.number, { bottom: inset + 12 * unit, fontSize: 15 * unit, color: colors.textMuted }]}
      >
        {formatCollectorNumber(card.number, seasonSize)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  inner: { position: 'absolute' },
  emblem: { opacity: 0.22 },
  gem: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  number: { position: 'absolute', alignSelf: 'center', fontFamily: fontFamilies.displayBold, letterSpacing: 0.5 },
});
