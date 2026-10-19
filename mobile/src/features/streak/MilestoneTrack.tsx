import { ScrollView, StyleSheet, View } from 'react-native';

import { Badge, Card, Heading, Icon, ProgressBar, Text } from '@/components/ui';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { RewardChips } from '@/features/progression/RewardChips';
import { fontFamilies, radius, spacing, useTheme } from '@/theme';

import type { StreakView } from './api';
import { milestoneProgress } from './calendar';
import { streakPalette } from './palette';

/** Next milestone with its reward preview, then every milestone as a track of medals. */
export function MilestoneTrack({ streak }: { streak: StreakView }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const next = streak.nextMilestone;
  const days = streak.milestones.map((milestone) => milestone.days);

  return (
    <Card>
      <Heading>{t('streak.milestones.title')}</Heading>
      {next ? (
        <View style={[styles.next, { backgroundColor: colors.surfaceRaised, borderColor: streakPalette.flameHot }]}>
          <View style={styles.nextHead}>
            <View style={[styles.goal, { backgroundColor: streakPalette.flameHot }]}>
              <Text allowFontScaling={false} color={streakPalette.onFlame} style={styles.goalDays}>
                {formatNumber(next.days, language)}
              </Text>
            </View>
            <View style={styles.flex}>
              <Text variant="bodyStrong">{t('streak.milestones.next', { count: next.days })}</Text>
              <Text variant="caption" tone="muted">
                {t('streak.milestones.remaining', { count: next.remaining })}
              </Text>
            </View>
          </View>
          <ProgressBar
            progress={milestoneProgress(streak.current, next.days, days)}
            color={streakPalette.flame}
            accessibilityLabel={t('streak.milestones.progressA11y', { current: streak.current, total: next.days })}
          />
          <View style={styles.rewards}>
            <RewardChips reward={next.reward} color={streakPalette.flameHot} textColor={streakPalette.onFlame} />
            {next.freezes > 0 ? (
              <Badge icon="snow" label={t('streak.milestones.freezes', { count: next.freezes })} color={streakPalette.ice} textColor={streakPalette.onIce} />
            ) : null}
          </View>
        </View>
      ) : (
        <Text variant="bodyStrong">{t('streak.milestones.allDone')}</Text>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
        {streak.milestones.map((milestone) => (
          <View
            key={milestone.days}
            style={styles.medal}
            accessible
            accessibilityLabel={t(milestone.reached ? 'streak.milestones.reachedA11y' : 'streak.milestones.lockedA11y', { count: milestone.days })}
          >
            <View
              style={[
                styles.medalFace,
                {
                  backgroundColor: milestone.reached ? streakPalette.flame : colors.surfaceRaised,
                  borderColor: milestone.reached ? streakPalette.flameHot : colors.border,
                },
              ]}
            >
              {milestone.reached ? (
                <Icon name="flame" size={22} color={streakPalette.onFlame} />
              ) : (
                <Icon name="lock-closed" size={18} tone="textMuted" />
              )}
            </View>
            <Text variant="caption" style={styles.medalDays} color={milestone.reached ? colors.text : colors.textMuted}>
              {formatNumber(milestone.days, language)}
            </Text>
          </View>
        ))}
      </ScrollView>
    </Card>
  );
}

const MEDAL = 48;

const styles = StyleSheet.create({
  next: { gap: spacing.sm, padding: spacing.sm, borderRadius: radius, borderWidth: 2 },
  nextHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  goal: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  goalDays: { fontFamily: fontFamilies.displayHeavy, fontSize: 22, lineHeight: 26 },
  flex: { flex: 1 },
  rewards: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
  track: { gap: spacing.sm, paddingVertical: spacing.xxs },
  medal: { alignItems: 'center', gap: spacing.xxs },
  medalFace: { width: MEDAL, height: MEDAL, borderRadius: MEDAL / 2, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  medalDays: { fontFamily: fontFamilies.bodyBold },
});
