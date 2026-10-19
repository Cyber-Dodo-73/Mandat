import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { seasonSize } from '@/data/catalog';
import { formatCollectorNumber, monogram, useCardText } from '@/features/collection/cardText';
import { useTranslation } from '@/i18n';
import { fontFamilies } from '@/theme';
import { palettes } from '@/theme/colors';
import { rarityStyles } from '@/theme/rarity';
import type { Card } from '@/types/card';

import { cardMetrics, type CardSize } from './cardMetrics';
import { FlagChip } from './FlagChip';

type CardSilhouetteProps = {
  card: Card;
  size?: CardSize;
  width?: number;
};

/**
 * A card the player does not own yet: the same silhouette as a real card (proportional to its
 * width), dimmed, with a faint monogram, its rarity gem, name, flag and collector number, so the
 * gap in the collection says who is missing. The photo is never revealed.
 */
export const CardSilhouette = memo(function CardSilhouette({ card, size = 'grid', width }: CardSilhouetteProps) {
  const { t } = useTranslation();
  const text = useCardText(card);
  const metrics = cardMetrics(size, width);
  const { width: w, height: h, radius, unit } = metrics;
  const colors = palettes.dark;
  const rarity = rarityStyles[card.rarity];
  const inset = metrics.frame;
  const gem = 16 * unit;

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
            borderWidth: Math.max(1, 3 * unit),
            borderColor: `${rarity.color}55`,
            backgroundColor: colors.background,
          },
        ]}
      />
      <Text allowFontScaling={false} style={[styles.monogram, { fontSize: 96 * unit, lineHeight: 110 * unit, color: `${rarity.color}26` }]}>
        {monogram(text.name)}
      </Text>
      <View
        style={[
          styles.gem,
          {
            top: inset + 10 * unit,
            right: inset + 10 * unit,
            width: gem,
            height: gem,
            borderRadius: 3 * unit,
            backgroundColor: rarity.color,
            borderColor: rarity.edge,
            borderWidth: Math.max(0.5, 2 * unit),
          },
        ]}
      />
      <View style={[styles.bottom, { left: inset + 12 * unit, right: inset + 12 * unit, bottom: inset + 12 * unit, gap: 6 * unit }]}>
        <Text allowFontScaling={false} numberOfLines={2} style={[styles.name, { fontSize: 25 * unit, lineHeight: 29 * unit, color: colors.textMuted }]}>
          {text.name}
        </Text>
        <View style={[styles.meta, { gap: 8 * unit }]}>
          <View style={styles.flag}>
            <FlagChip country={card.country} continent={card.continent} height={16 * unit} />
          </View>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.number, { fontSize: 13 * unit, color: colors.textMuted }]}>
            {formatCollectorNumber(card.number, seasonSize)}
          </Text>
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  inner: { position: 'absolute', borderStyle: 'dashed' },
  monogram: { fontFamily: fontFamilies.displayHeavy, marginTop: '-20%' },
  gem: { position: 'absolute', transform: [{ rotate: '45deg' }] },
  bottom: { position: 'absolute' },
  name: { fontFamily: fontFamilies.displayHeavy },
  meta: { flexDirection: 'row', alignItems: 'center' },
  flag: { opacity: 0.7 },
  number: { fontFamily: fontFamilies.bodySemiBold },
});
