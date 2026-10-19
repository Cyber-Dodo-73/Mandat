import { Canvas, RadialGradient, Rect } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN, scheduleOnUI } from 'react-native-worklets';

import { CardBack } from '@/components/cards';
import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { Booster3D, BOOSTER_RATIO, boosterGeometry, CardFanStage, useDeviceTilt, type CardSlotRenderer } from '@/components/pack';
import { Body, Button3D, Caption, Heading, Icon, PressableScale } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { errorMessageKey } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { spacing, useTheme } from '@/theme';
import { instant, springs } from '@/theme/motion';
import { packPalettes, type PackTheme } from '@/theme/packs';

import { PackRecap } from './PackRecap';
import { useOpenPackAttempt } from './queries';
import { RevealSequence } from './RevealSequence';

/** Share of the pack width the finger must cover to tear the strip off. */
const TEAR_DISTANCE = 0.8;
/** Releasing past this point finishes the tear instead of springing back. */
const TEAR_COMMIT = 0.7;
const TEAR_TICK = 0.08;
/** Extra touch area under the seam that still starts a tear. */
const TEAR_ZONE_MARGIN = 28;
const PAN_TILT_DISTANCE = 140;
const CARDS_DELAY_MS = 850;

const MODE_TILT = 0;
const MODE_TEAR = 1;

/** ready: tear the pack; fan: the cards leave it; reveal: one by one; recap: all five. */
type Phase = 'ready' | 'fan' | 'reveal' | 'recap';

const PACK_THEMES: readonly PackTheme[] = ['standard', 'africa', 'asia', 'europe', 'north_america', 'south_america', 'oceania'];

const clampUnit = (value: number) => {
  'worklet';
  return Math.max(-1, Math.min(1, value));
};

export function PackOpeningScreen() {
  const params = useLocalSearchParams<{ packId?: string; theme?: string }>();
  const packId = params.packId ?? 's1-standard';
  const theme = PACK_THEMES.find((candidate) => candidate === params.theme) ?? 'standard';
  // Each round is a new opening attempt, with its own idempotency key.
  const [round, setRound] = useState(0);
  return <PackOpeningRound key={round} packId={packId} theme={theme} onOpenAnother={() => setRound((value) => value + 1)} />;
}

type PackOpeningRoundProps = { packId: string; theme: PackTheme; onOpenAnother: () => void };

function PackOpeningRound({ packId, theme, onOpenAnother }: PackOpeningRoundProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const online = useIsOnline();
  const palette = packPalettes[theme];

  const attempt = useOpenPackAttempt(packId);
  const { mutate, isIdle } = attempt;
  const [phase, setPhase] = useState<Phase>('ready');
  const result = attempt.data;
  const canTear = Boolean(result) && phase === 'ready';

  // The opening request starts with the screen: the pack floats while the server draws.
  useEffect(() => {
    if (online && isIdle) mutate();
  }, [isIdle, mutate, online]);

  const packWidth = Math.round(Math.min(screenWidth * 0.64, (screenHeight * 0.5) / BOOSTER_RATIO, 280));
  const geometry = useMemo(() => boosterGeometry(packWidth), [packWidth]);

  const gyro = useDeviceTilt(!reduceMotion && phase === 'ready');
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const tiltX = useDerivedValue(() => clampUnit(gyro.x.get() + panX.get()));
  const tiltY = useDerivedValue(() => clampUnit(gyro.y.get() + panY.get()));

  const tear = useSharedValue(0);
  const stripFlight = useSharedValue(0);
  const packDrop = useSharedValue(0);
  const mode = useSharedValue(MODE_TILT);
  const torn = useSharedValue(0);
  const lastTick = useSharedValue(0);
  const tearEnabled = useSharedValue(0);

  useEffect(() => {
    tearEnabled.set(canTear ? 1 : 0);
  }, [canTear, tearEnabled]);

  const onTorn = () => {
    playSound('tear');
    haptics.flipRare();
    setTimeout(() => setPhase('fan'), reduceMotion ? 0 : CARDS_DELAY_MS);
  };

  const finishTear = () => {
    'worklet';
    if (torn.get() === 1) return;
    torn.set(1);
    tear.set(withTiming(1, reduceMotion ? instant : { duration: 120 }));
    stripFlight.set(withTiming(1, reduceMotion ? instant : { duration: 480, easing: Easing.out(Easing.cubic) }));
    packDrop.set(
      reduceMotion ? withTiming(1, instant) : withDelay(380, withTiming(1, { duration: 520, easing: Easing.in(Easing.cubic) })),
    );
    scheduleOnRN(onTorn);
  };

  const tickHaptic = () => haptics.tearTick();

  const pan = usePanGesture({
    minDistance: 2,
    onBegin: (event) => {
      const inStrip = event.y < geometry.seamY + TEAR_ZONE_MARGIN;
      mode.set(tearEnabled.get() === 1 && torn.get() === 0 && inStrip ? MODE_TEAR : MODE_TILT);
      lastTick.set(0);
    },
    onUpdate: (event) => {
      if (mode.get() === MODE_TEAR) {
        if (torn.get() === 1) return;
        const progress = Math.max(0, Math.min(1, event.translationX / (packWidth * TEAR_DISTANCE)));
        tear.set(progress);
        const tick = Math.floor(progress / TEAR_TICK);
        if (tick > lastTick.get()) {
          lastTick.set(tick);
          scheduleOnRN(tickHaptic);
        }
        if (progress >= 1) finishTear();
      } else {
        panX.set(clampUnit(event.translationX / PAN_TILT_DISTANCE));
        panY.set(clampUnit(event.translationY / PAN_TILT_DISTANCE));
      }
    },
    onFinalize: () => {
      if (mode.get() === MODE_TEAR && torn.get() === 0) {
        if (tear.get() >= TEAR_COMMIT) finishTear();
        else tear.set(withSpring(0, springs.gentle));
      }
      panX.set(withSpring(0, springs.gentle));
      panY.set(withSpring(0, springs.gentle));
    },
  });

  const dropStyle = useAnimatedStyle(() => ({
    opacity: 1 - packDrop.get(),
    transform: [{ translateY: packDrop.get() * screenHeight * 0.7 }, { scale: 1 - packDrop.get() * 0.15 }],
  }));

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }]}>
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <Rect x={0} y={0} width={screenWidth} height={screenHeight}>
          <RadialGradient
            c={{ x: screenWidth / 2, y: screenHeight * 0.42 }}
            r={screenWidth * 0.9}
            colors={[`${palette.glow}55`, `${palette.glow}00`]}
          />
        </Rect>
      </Canvas>

      <View style={styles.header}>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          hitSlop={12}
          onPress={() => router.back()}
        >
          <Icon name="close" size={30} />
        </PressableScale>
      </View>

      {phase === 'ready' ? (
        <>
          <View style={styles.stage}>
            <Animated.View style={dropStyle}>
              <GestureDetector gesture={pan}>
                <Animated.View
                  accessible={canTear}
                  accessibilityRole="button"
                  accessibilityLabel={t('packOpening.tearAction')}
                  accessibilityActions={canTear ? [{ name: 'activate', label: t('packOpening.tearAction') }] : []}
                  onAccessibilityAction={() => {
                    if (canTear) scheduleOnUI(finishTear);
                  }}
                >
                  <Booster3D
                    width={packWidth}
                    palette={palette}
                    wordmark={APP_NAME}
                    seasonLabel={t('packs.seasonLabel', { season: 1 })}
                    title={t(`packs.names.${theme}`)}
                    accessibilityLabel={t('packs.packA11y', { name: t(`packs.names.${theme}`), season: 1 })}
                    tiltX={tiltX}
                    tiltY={tiltY}
                    float
                    entrance
                    tearProgress={tear}
                    stripFlight={stripFlight}
                    showPerforation={canTear}
                  />
                </Animated.View>
              </GestureDetector>
            </Animated.View>
          </View>

          <View style={styles.footer}>
            {attempt.isError ? (
              <>
                <Body align="center">{t(errorMessageKey(attempt.error))}</Body>
                <Caption align="center">{t('packOpening.error')}</Caption>
                {/* Same idempotency key: a request that did reach the server returns the same cards. */}
                <Button3D label={t('common.retry')} variant="secondary" disabled={!online} onPress={() => mutate()} />
              </>
            ) : !online && !result ? (
              <OfflineNotice message={t('offline.packOpening')} />
            ) : result ? (
              <Body tone="muted" align="center">
                {t('packOpening.tearHint')}
              </Body>
            ) : (
              <View style={styles.preparing}>
                <ActivityIndicator color={colors.textMuted} />
                <Caption>{t('packOpening.preparing')}</Caption>
              </View>
            )}
          </View>
        </>
      ) : result && phase === 'fan' ? (
        <>
          <View style={styles.stage}>
            <CardFanStage cards={result.cards} cardWidth={Math.round(Math.min(screenWidth * 0.3, 132))} renderCard={renderFanCard} />
          </View>
          <View style={styles.footer}>
            <Heading align="center">{t('packOpening.cardsReady')}</Heading>
            <View style={styles.cta}>
              <Button3D label={t('packOpening.reveal')} icon="sparkles" size="lg" fullWidth onPress={() => setPhase('reveal')} />
            </View>
          </View>
        </>
      ) : result && phase === 'reveal' ? (
        <RevealSequence
          cards={result.cards}
          cardWidth={Math.round(Math.min(screenWidth * 0.72, 300))}
          onDone={() => setPhase('recap')}
        />
      ) : result && phase === 'recap' ? (
        <PackRecap result={result} onOpenAnother={onOpenAnother} />
      ) : null}
    </View>
  );
}

/** Face-down backs in the fan; the last one glows with its rarity (the suspense). */
const renderFanCard: CardSlotRenderer = ({ card, isLast, width }) => (
  <CardBack width={width} size="grid" glow={isLast ? card.rarity : undefined} />
);

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 120 },
  preparing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  cta: { alignSelf: 'stretch', paddingHorizontal: spacing.lg },
});
