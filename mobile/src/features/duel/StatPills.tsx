import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { STAT_KEYS, type CardStats, type StatKey } from '@/types/card';

type StatPillsProps = {
  stats: CardStats;
  /** The round's domain is highlighted, the others stay quiet. */
  highlight?: StatKey | null;
};

/** The four stats of a card in one row: what a duel round compares. */
export function StatPills({ stats, highlight }: StatPillsProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={STAT_KEYS.map((key) => `${t(`cards.stats.${key}`)} ${stats[key]}`).join(', ')}
    >
      {STAT_KEYS.map((key) => {
        const active = highlight === key;
        return (
          <View
            key={key}
            style={[
              styles.pill,
              { backgroundColor: active ? colors.accent : colors.surfaceRaised, borderColor: active ? colors.accent : colors.border },
            ]}
          >
            <Text variant="caption" color={active ? colors.onAccent : colors.textMuted}>
              {t(`cards.statsShort.${key}`)}
            </Text>
            <Text variant="label" color={active ? colors.onAccent : colors.text} style={styles.value}>
              {stats[key]}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.xxs },
  pill: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 3,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  value: { fontVariant: ['tabular-nums'] },
});
