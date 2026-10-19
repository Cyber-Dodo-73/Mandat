import { router } from 'expo-router';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';

import { Badge, Body, Button3D, Text, Title } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { playCoin, playSound } from '@/lib/sounds';
import { spacing } from '@/theme';

import type { Duel } from './api';

/** Final score and the Influence granted by the server. */
export function DuelEnd({ duel }: { duel: Duel }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const reduceMotion = useReduceMotion();
  const winner = duel.winner ?? 'draw';

  useEffect(() => {
    if (winner === 'player') {
      haptics.levelUp();
      playSound('duel_win');
    } else if (winner === 'ai') {
      haptics.error();
      playSound('duel_lose');
    } else {
      haptics.tap();
    }
    playCoin(duel.reward?.influence, 700);
  }, [duel.reward?.influence, winner]);

  return (
    <View style={styles.root}>
      <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(13)} style={styles.head}>
        <Title align="center">{t(`duel.end.${winner}`)}</Title>
        <Text
          variant="display"
          align="center"
          accessibilityLabel={t('duel.scoreA11y', { player: duel.playerScore, ai: duel.aiScore })}
        >
          {duel.playerScore} – {duel.aiScore}
        </Text>
        <Body tone="muted" align="center">
          {t(`duel.difficulty.${duel.difficulty}`)}
        </Body>
      </Animated.View>
      {duel.reward && duel.reward.influence > 0 ? (
        <View style={styles.rewards}>
          <Badge label={t('duel.end.influence', { amount: formatNumber(duel.reward.influence, language) })} />
          <Badge label={t('duel.end.xp')} />
        </View>
      ) : null}
      {duel.reward?.capped ? (
        <Body tone="muted" align="center">
          {t('duel.end.rewardCapped')}
        </Body>
      ) : null}
      <View style={styles.actions}>
        <Button3D label={t('duel.end.again')} icon="refresh" size="lg" fullWidth onPress={() => router.replace('/duel')} />
        <Button3D label={t('duel.end.done')} variant="secondary" fullWidth onPress={() => router.back()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', gap: spacing.lg, padding: spacing.lg },
  head: { alignItems: 'center', gap: spacing.xs },
  rewards: { flexDirection: 'row', justifyContent: 'center', flexWrap: 'wrap', gap: spacing.xs },
  actions: { gap: spacing.sm },
});
