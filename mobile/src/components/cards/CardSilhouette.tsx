import { memo } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { seasonSize } from '@/data/catalog';
import { formatCollectorNumber } from '@/features/collection/cardText';
import { useTranslation } from '@/i18n';
import { fontFamilies } from '@/theme';
import { palettes } from '@/theme/colors';

import { cardMetrics, type CardSize } from './cardMetrics';

type CardSilhouetteProps = {
  number: number;
  size?: CardSize;
  width?: number;
};

/** A card the player does not own yet: an empty slot with its collector number. */
export const CardSilhouette = memo(function CardSilhouette({ number, size = 'grid', width }: CardSilhouetteProps) {
  const { t } = useTranslation();
  const { width: w, height: h, radius } = cardMetrics(size, width);
  const colors = palettes.dark;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('cards.silhouetteA11y', { number })}
      style={[
        styles.slot,
        { width: w, height: h, borderRadius: radius, backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.number, { fontSize: w * 0.2, color: colors.border }]}>
        {String(number).padStart(3, '0')}
      </Text>
      <Text allowFontScaling={false} style={[styles.total, { fontSize: Math.max(7, w * 0.08), color: colors.textMuted }]}>
        {formatCollectorNumber(number, seasonSize)}
      </Text>
    </View>
  );
});

const styles = StyleSheet.create({
  slot: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderStyle: 'dashed' },
  number: { fontFamily: fontFamilies.displayHeavy },
  total: { fontFamily: fontFamilies.bodySemiBold, position: 'absolute', bottom: '6%' },
});
