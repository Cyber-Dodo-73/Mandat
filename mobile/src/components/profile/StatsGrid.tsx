import { StyleSheet, View } from 'react-native';

import { Icon, Text, type IconName } from '@/components/ui';
import type { PublicProfile } from '@/features/profile/queries';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';
import { rarityStyles } from '@/theme/rarity';

type Stat = { key: string; icon: IconName; value: string; label: string; color?: string };

/** Numbers of a player's career, two per row, values first. */
export function StatsGrid({ stats }: { stats: PublicProfile['stats'] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const n = (value: number) => formatNumber(value, language);

  const items: Stat[] = [
    { key: 'collection', icon: 'albums', value: `${n(Math.round(stats.collectionPercent))} %`, label: t('profile.stats.collection', { count: stats.distinctCards, total: stats.seasonCards }) },
    { key: 'level', icon: 'trending-up', value: n(stats.level), label: t('profile.stats.level') },
    { key: 'packs', icon: 'gift', value: n(stats.packsOpened), label: t('profile.stats.packs') },
    { key: 'streak', icon: 'flame', value: n(stats.bestStreak), label: t('profile.stats.bestStreak') },
    { key: 'legendary', icon: 'trophy', value: n(stats.legendaryCards), label: t('profile.stats.legendary'), color: rarityStyles.legendary.color },
    { key: 'mythic', icon: 'sparkles', value: n(stats.mythicCards), label: t('profile.stats.mythic'), color: rarityStyles.mythic.color },
    { key: 'duels', icon: 'flash', value: n(stats.duelWins), label: t('profile.stats.duelWins') },
  ];

  return (
    <View style={styles.grid}>
      {items.map((item) => (
        <View
          key={item.key}
          accessible
          accessibilityLabel={`${item.value} ${item.label}`}
          style={[styles.cell, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <View style={styles.valueRow}>
            <Icon name={item.icon} size={16} color={item.color ?? colors.textMuted} />
            <Text variant="heading" allowFontScaling={false}>
              {item.value}
            </Text>
          </View>
          <Text variant="caption" tone="muted" numberOfLines={2}>
            {item.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  cell: {
    flexBasis: '48%',
    flexGrow: 1,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius,
    padding: spacing.sm,
    gap: 2,
  },
  valueRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
