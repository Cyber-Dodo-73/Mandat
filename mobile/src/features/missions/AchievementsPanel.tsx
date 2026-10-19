import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Body, Button3D, Caption, Heading, Icon, ProgressBar, Text, type IconName } from '@/components/ui';
import type { Achievement } from '@/features/progression/api';
import { achievementCategoryLabel, achievementLabel, loose } from '@/features/progression/labels';
import { useAchievementsQuery } from '@/features/progression/queries';
import { RewardChips } from '@/features/progression/RewardChips';
import { formatDate, useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { parseInstant } from '@/lib/time';
import { radius, spacing, useTheme } from '@/theme';

const CATEGORY_ICONS: Record<string, IconName> = {
  packs: 'gift',
  collection: 'albums',
  continents: 'earth',
  eras: 'hourglass',
  rarities: 'diamond',
  finishes: 'sparkles',
  streaks: 'flame',
  levels: 'trending-up',
  quiz: 'book',
  duels: 'flash',
  workshop: 'construct',
};

/** Every achievement, grouped by category, locked ones greyed out. */
export function AchievementsPanel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const achievements = useAchievementsQuery();

  const groups = useMemo(() => {
    const byCategory = new Map<string, Achievement[]>();
    for (const achievement of achievements.data?.achievements ?? []) {
      const list = byCategory.get(achievement.category) ?? [];
      list.push(achievement);
      byCategory.set(achievement.category, list);
    }
    return [...byCategory.entries()];
  }, [achievements.data]);

  if (!achievements.data) {
    return achievements.isError ? (
      <View style={styles.centered}>
        <Body tone="muted" align="center">
          {describeError(achievements.error, t)}
        </Body>
        <Button3D label={t('common.retry')} variant="secondary" onPress={() => void achievements.refetch()} />
      </View>
    ) : (
      <ActivityIndicator color={colors.textMuted} style={styles.loader} />
    );
  }

  const { unlockedCount, totalCount } = achievements.data;
  return (
    <View style={styles.panel}>
      <View style={styles.summary}>
        <Text variant="title">{t('achievements.count', { unlocked: unlockedCount, total: totalCount })}</Text>
        <ProgressBar progress={unlockedCount / Math.max(1, totalCount)} accessibilityLabel={t('achievements.title')} />
      </View>
      {groups.map(([category, list]) => (
        <View key={category} style={styles.group}>
          <Heading>{achievementCategoryLabel(loose(t), category)}</Heading>
          <View style={styles.grid}>
            {list.map((achievement) => (
              <AchievementTile key={achievement.id} achievement={achievement} icon={CATEGORY_ICONS[category] ?? 'ribbon'} />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

function AchievementTile({ achievement, icon }: { achievement: Achievement; icon: IconName }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const unlocked = Boolean(achievement.unlockedAt);
  const label = achievementLabel(loose(t), achievement);
  const progress = Math.min(achievement.progress, achievement.threshold);
  const unlockedAt = achievement.unlockedAt ? parseInstant(achievement.unlockedAt) : null;

  return (
    <View
      accessible
      accessibilityLabel={
        unlocked
          ? t('achievements.unlockedA11y', { label })
          : t('achievements.lockedA11y', { label, current: progress, total: achievement.threshold })
      }
      style={[
        styles.tile,
        { backgroundColor: colors.surface, borderColor: unlocked ? colors.accent : colors.border },
        unlocked ? null : styles.locked,
      ]}
    >
      <View style={[styles.medal, { backgroundColor: unlocked ? colors.accent : colors.surfaceRaised }]}>
        <Icon name={unlocked ? icon : 'lock-closed'} size={22} color={unlocked ? colors.onAccent : colors.textMuted} />
      </View>
      <Text variant="label" numberOfLines={2}>
        {label}
      </Text>
      {unlocked ? (
        <Caption>{unlockedAt ? t('achievements.unlockedOn', { date: formatDate(new Date(unlockedAt), language) }) : null}</Caption>
      ) : (
        <>
          <ProgressBar progress={progress / Math.max(1, achievement.threshold)} height={8} />
          <Caption>{t('missions.progress', { current: progress, total: achievement.threshold })}</Caption>
        </>
      )}
      <RewardChips reward={achievement.reward} />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.lg },
  summary: { gap: spacing.sm },
  group: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tile: {
    width: '48%',
    flexGrow: 1,
    padding: spacing.sm,
    gap: spacing.xs,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  locked: { opacity: 0.55 },
  medal: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  centered: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  loader: { paddingVertical: spacing.xl },
});
