import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Body, Button3D, Caption, Card, Heading, Icon, ProgressBar, Text } from '@/components/ui';
import { useSettingsStore } from '@/features/settings/store';
import type { Mission } from '@/features/progression/api';
import { loose, missionLabel } from '@/features/progression/labels';
import { missionsQueryKey, useClaimMission, useMissionsQuery } from '@/features/progression/queries';
import { RewardChips } from '@/features/progression/RewardChips';
import { useNotificationPermission } from '@/features/progression/useNotificationSync';
import { useCountdown } from '@/hooks/useCountdown';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { formatCountdown, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { spacing, useTheme } from '@/theme';

/** Daily and weekly missions, with their server reset times. */
export function MissionsPanel() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const missions = useMissionsQuery();

  if (!missions.data) {
    return missions.isError ? (
      <View style={styles.centered}>
        <Body tone="muted" align="center">
          {describeError(missions.error, t)}
        </Body>
        <Button3D label={t('common.retry')} variant="secondary" onPress={() => void missions.refetch()} />
      </View>
    ) : (
      <ActivityIndicator color={colors.textMuted} style={styles.loader} />
    );
  }

  return (
    <View style={styles.panel}>
      <ReminderOptIn />
      <MissionGroup title={t('missions.daily')} resetAt={missions.data.dailyResetAt} missions={missions.data.daily} />
      <MissionGroup title={t('missions.weekly')} resetAt={missions.data.weeklyResetAt} missions={missions.data.weekly} />
    </View>
  );
}

function MissionGroup({ title, resetAt, missions }: { title: string; resetAt: string; missions: readonly Mission[] }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  // At the reset the server hands out new missions: fetch them instead of showing 00:00:00.
  const refresh = useCallback(() => void queryClient.invalidateQueries({ queryKey: missionsQueryKey }), [queryClient]);
  const secondsLeft = useCountdown(resetAt, refresh);
  const days = Math.floor(secondsLeft / 86_400);
  const resetText =
    days > 0
      ? t('missions.resetInDays', { count: days, time: formatCountdown(secondsLeft % 86_400) })
      : t('missions.resetIn', { time: formatCountdown(secondsLeft) });

  return (
    <View style={styles.group}>
      <View style={styles.groupHeader}>
        <Heading style={styles.flex}>{title}</Heading>
        <Caption>{resetText}</Caption>
      </View>
      {missions.length === 0 ? <Body tone="muted">{t('missions.empty')}</Body> : null}
      {missions.map((mission, index) => (
        <MissionRow key={mission.id} mission={mission} index={index} />
      ))}
    </View>
  );
}

function MissionRow({ mission, index }: { mission: Mission; index: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const claim = useClaimMission();
  const label = missionLabel(loose(t), mission);
  const progress = Math.min(mission.progress, mission.target);

  return (
    <Animated.View entering={reduceMotion ? undefined : FadeInDown.delay(index * 60).springify()}>
      <Card style={mission.claimed ? styles.claimed : null}>
        <View style={styles.rowHeader}>
          <Text variant="bodyStrong" style={styles.flex}>
            {label}
          </Text>
          {mission.claimed ? <Icon name="checkmark-circle" size={22} tone="success" /> : null}
        </View>
        <ProgressBar
          progress={progress / Math.max(1, mission.target)}
          color={mission.completed ? colors.success : undefined}
          accessibilityLabel={t('missions.progressA11y', { label, current: progress, total: mission.target })}
        />
        <View style={styles.rowFooter}>
          <Caption>{t('missions.progress', { current: progress, total: mission.target })}</Caption>
          <RewardChips reward={mission.reward} />
        </View>
        {mission.completed && !mission.claimed ? (
          <Button3D
            label={t('missions.claim')}
            icon="gift"
            loading={claim.isPending}
            onPress={() => claim.mutate(mission.id)}
            fullWidth
          />
        ) : null}
        {claim.isError ? (
          <Caption tone="danger">{describeError(claim.error, t)}</Caption>
        ) : null}
      </Card>
    </Animated.View>
  );
}

/** Reminders are only offered here, once the player sees what they are for. */
function ReminderOptIn() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((state) => state.notificationsEnabled);
  const { permission, request } = useNotificationPermission();
  if (!enabled || permission !== 'undetermined') return null;
  return (
    <Card>
      <View style={styles.rowHeader}>
        <Icon name="notifications" size={22} tone="accent" />
        <Text variant="bodyStrong" style={styles.flex}>
          {t('notifications.optIn.title')}
        </Text>
      </View>
      <Body tone="muted">{t('notifications.optIn.body')}</Body>
      <Button3D label={t('notifications.optIn.cta')} variant="secondary" onPress={() => void request()} fullWidth />
    </Card>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.lg },
  group: { gap: spacing.sm },
  groupHeader: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  rowHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  rowFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm, flexWrap: 'wrap' },
  claimed: { opacity: 0.6 },
  flex: { flex: 1 },
  centered: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  loader: { paddingVertical: spacing.xl },
});
