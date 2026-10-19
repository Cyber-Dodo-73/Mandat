import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withDelay, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Wordmark } from '@/components/brand';
import { TradingCard } from '@/components/cards';
import { Body, Button3D, Caption, PressableScale, Text } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { sampleCards } from '@/data/catalog';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { spacing, useTheme } from '@/theme';
import { springs } from '@/theme/motion';
import type { Card } from '@/types/card';

import { SocialSignIn } from './SocialSignIn';

/** Fan of the three rarest sample cards: the collection is the pitch. */
const FAN = [
  { rarity: 'epic', rotate: -11, x: -0.62, y: 26 },
  { rarity: 'mythic', rotate: 0, x: 0, y: 0 },
  { rarity: 'legendary', rotate: 11, x: 0.62, y: 26 },
] as const;

export function WelcomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onError = useCallback((cause: unknown) => setError(describeError(cause, t)), [t]);

  const samples = useMemo(() => new Map(sampleCards().map(({ rarity, card }) => [rarity, card])), []);
  const cardWidth = Math.round(Math.min(width * 0.36, 168));

  return (
    <View
      style={[
        styles.root,
        { backgroundColor: colors.background, paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.md },
      ]}
    >
      <View style={[styles.fan, { height: cardWidth * 1.65 }]}>
        {FAN.map((slot, index) => {
          const card = samples.get(slot.rarity);
          return card ? <FanCard key={slot.rarity} card={card} index={index} width={cardWidth} {...slot} /> : null;
        })}
      </View>

      <View style={styles.copy}>
        <Wordmark width={Math.min(width * 0.62, 280)} accessibilityLabel={APP_NAME} />
        <Body tone="muted">{t('auth.welcome.pitch')}</Body>
      </View>

      <View style={styles.actions}>
        {error ? (
          <Caption tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Caption>
        ) : null}
        <Button3D label={t('auth.welcome.create')} size="lg" fullWidth disabled={busy} onPress={() => router.push('/register')} />
        <SocialSignIn busy={busy} onBusyChange={setBusy} onError={onError} />
        <PressableScale
          accessibilityRole="link"
          hitSlop={10}
          disabled={busy}
          onPress={() => router.push('/login')}
          style={styles.login}
        >
          <Text variant="label" tone="accent" align="center">
            {t('auth.welcome.login')}
          </Text>
        </PressableScale>
      </View>
    </View>
  );
}

type FanCardProps = { card: Card; index: number; width: number; rotate: number; x: number; y: number };

function FanCard({ card, index, width, rotate, x, y }: FanCardProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (!reduceMotion) progress.set(withDelay(150 + index * 110, withSpring(1, springs.bounce)));
  }, [index, progress, reduceMotion]);

  const style = useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: Math.min(1, p * 1.5),
      transform: [
        { translateX: x * width * p },
        { translateY: y + (1 - p) * 120 },
        { rotate: `${rotate * p}deg` },
        { scale: 0.8 + 0.2 * p },
      ],
    };
  });

  return (
    <Animated.View style={[styles.fanCard, { marginLeft: -width / 2, zIndex: x === 0 ? 2 : 1 }, style]}>
      <TradingCard card={card} width={width} size="large" interactive={false} gyro={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'space-between' },
  fan: { width: '100%', marginTop: spacing.md },
  fanCard: { position: 'absolute', left: '50%', top: 0 },
  copy: { gap: spacing.xs },
  actions: { gap: spacing.sm },
  login: { paddingVertical: spacing.xs },
});
