import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Badge, Body, Button3D, Card, Heading, Icon, Text, Title } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { spacing, useTheme } from '@/theme';

import type { QuizResult } from './api';

type QuizEndProps = { result: QuizResult; onRetry: () => void };

/** Score, Influence earned and the bonus booster every 5 perfect quizzes (all from the server). */
export function QuizEnd({ result, onRetry }: QuizEndProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();

  useEffect(() => {
    if (result.bonusPack || result.perfect) {
      haptics.levelUp();
      playSound('level_up');
    } else {
      haptics.missionComplete();
      playSound('mission_complete');
    }
  }, [result.bonusPack, result.perfect]);

  return (
    <View style={styles.root}>
      <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(14)} style={styles.score}>
        <Text variant="display" align="center" accessibilityLabel={t('quiz.end.scoreA11y', { correct: result.correctAnswers, total: result.totalQuestions })}>
          {result.correctAnswers}/{result.totalQuestions}
        </Text>
        <Title align="center">
          {result.perfect ? t('quiz.end.perfect') : result.correctAnswers >= result.totalQuestions / 2 ? t('quiz.end.good') : t('quiz.end.keepGoing')}
        </Title>
      </Animated.View>

      <View style={styles.rewards}>
        {result.influence > 0 ? (
          <Badge label={t('quiz.end.influence', { amount: formatNumber(result.influence, language) })} />
        ) : null}
        <Badge label={t('quiz.end.xp')} />
      </View>

      {result.bonusPack ? (
        <Card raised style={[styles.bonus, { borderColor: colors.accent }]}>
          <Icon name="gift" size={36} tone="accent" />
          <View style={styles.bonusText}>
            <Heading>{t('quiz.end.bonusPackTitle')}</Heading>
            <Body tone="muted">{t('quiz.end.bonusPackBody')}</Body>
          </View>
        </Card>
      ) : null}

      <View style={styles.actions}>
        <Button3D label={t('quiz.end.retry')} icon="refresh" fullWidth size="lg" onPress={onRetry} />
        <Button3D label={t('quiz.end.done')} variant="secondary" fullWidth onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  score: { alignItems: 'center', gap: spacing.xs },
  rewards: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.xs },
  bonus: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, borderWidth: 2 },
  bonusText: { flex: 1, gap: spacing.xxs },
  actions: { gap: spacing.sm },
});
