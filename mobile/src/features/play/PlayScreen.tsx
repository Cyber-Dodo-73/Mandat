import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { Badge, Body, Caption, Heading, Icon, PressableScale, ScreenContainer, Title, type IconName } from '@/components/ui';
import { activeDuel } from '@/features/duel/api';
import { useFtueAnchor } from '@/features/ftue';
import { useAchievementsQuery } from '@/features/progression/queries';
import { activeQuiz } from '@/features/quiz/api';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useTranslation } from '@/i18n';
import { buttonDepth, radius, spacing, useTheme } from '@/theme';

import { PERFECT_QUIZZES_PER_BONUS, playStats } from './playStats';

/** Play hub: the two game modes, with the counters the server keeps for them. */
export function PlayScreen() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const achievements = useAchievementsQuery();
  const stats = playStats(achievements.data);
  const [resumable, setResumable] = useState({ quiz: false, duel: false });
  const quizAnchor = useFtueAnchor('play.quiz');

  // Resume hints come from ids stored on the device; refreshed whenever the tab shows.
  useFocusEffect(
    useCallback(() => {
      setResumable({ quiz: Boolean(activeQuiz.get()), duel: Boolean(activeDuel.get()) });
    }, []),
  );

  const quizStat =
    stats.perfectTowardsBonus === null
      ? t('play.quiz.bonusRule', { count: PERFECT_QUIZZES_PER_BONUS })
      : t('play.quiz.towardsBonus', { current: stats.perfectTowardsBonus, total: PERFECT_QUIZZES_PER_BONUS });
  const duelStat = t('play.duel.wins', {
    count: stats.duelWins,
    value: stats.duelWinsCapped ? `${stats.duelWins}+` : String(stats.duelWins),
  });

  return (
    <ScreenContainer>
      <Title>{t('play.title')}</Title>
      {!online ? <OfflineNotice message={t('play.offline')} /> : null}
      <View ref={quizAnchor}>
        <ModeTile
          icon="help-buoy"
          title={t('play.quiz.title')}
          description={t('play.quiz.description')}
          stat={quizStat}
          resume={resumable.quiz}
          disabled={!online}
          onPress={() => router.push('/quiz')}
        />
      </View>
      <ModeTile
        icon="shield-half"
        title={t('play.duel.title')}
        description={t('play.duel.description')}
        stat={duelStat}
        resume={resumable.duel}
        disabled={!online}
        onPress={() => router.push('/duel')}
      />
    </ScreenContainer>
  );
}

type ModeTileProps = {
  icon: IconName;
  title: string;
  description: string;
  stat: string;
  resume: boolean;
  disabled: boolean;
  onPress: () => void;
};

/** A big pressable tile with the same 3D edge as the app's buttons. */
function ModeTile({ icon, title, description, stat, resume, disabled, onPress }: ModeTileProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${title}. ${description}. ${stat}`}
      accessibilityState={{ disabled }}
      accessibilityHint={resume ? t('play.resumeHint') : undefined}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          borderBottomColor: colors.neutralButtonEdge,
          opacity: disabled ? 0.55 : 1,
        },
      ]}
    >
      <View style={styles.tileHead}>
        <View style={[styles.emblem, { backgroundColor: colors.accent }]}>
          <Icon name={icon} size={34} tone="onAccent" />
        </View>
        <View style={styles.tileText}>
          <Heading>{title}</Heading>
          <Body tone="muted">{description}</Body>
        </View>
      </View>
      <View style={styles.tileFoot}>
        <Caption tone="muted" style={styles.stat}>
          {stat}
        </Caption>
        {resume ? <Badge label={t('play.resume')} icon="play" /> : <Icon name="chevron-forward" size={22} tone="textMuted" />}
      </View>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  tile: {
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius,
    borderWidth: 1,
    borderBottomWidth: buttonDepth,
  },
  tileHead: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  emblem: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  tileText: { flex: 1, gap: spacing.xxs },
  tileFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  stat: { flex: 1 },
});
