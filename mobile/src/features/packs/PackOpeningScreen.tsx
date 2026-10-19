import { Canvas, RadialGradient, Rect } from '@shopify/react-native-skia';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View, type LayoutChangeEvent } from 'react-native';
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

import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import {
  Booster3D,
  BOOSTER_RATIO,
  boosterGeometry,
  initialTearState,
  TEAR_COMPLETE,
  tearCoverage,
  tearRelease,
  tearStep,
  tearTolerance,
  useDeviceTilt,
  type TearArea,
} from '@/components/pack';
import { Body, Button3D, Caption, Icon, PressableScale } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { spacing, useTheme } from '@/theme';
import { instant, springs } from '@/theme/motion';
import { packPalettes, type PackTheme } from '@/theme/packs';

import { PackRecap } from './PackRecap';
import { useOpenPackAttempt } from './queries';
import { RevealStack } from './RevealStack';

/** Light haptic tick every time the cut grows by this share of the width. */
const TEAR_TICK = 0.08;
const PAN_TILT_DISTANCE = 140;
const STACK_DELAY_MS = 650;

/** ready: cut the pack open; stack: flip the cards one by one; recap: all five. */
type Phase = 'ready' | 'stack' | 'recap';

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

  // Cut extent as fractions of the pack width, fed by the blade gesture.
  const cutFrom = useSharedValue(0);
  const cutTo = useSharedValue(0);
  const cutDirection = useSharedValue(1);
  const stripFlight = useSharedValue(0);
  const packDrop = useSharedValue(0);
  const torn = useSharedValue(0);
  const lastTick = useSharedValue(0);
  const tearEnabled = useSharedValue(0);
  const tearState = useSharedValue(initialTearState());
  const tearArea = useSharedValue<TearArea>({
    left: 0,
    top: 0,
    width: packWidth,
    seamY: geometry.seamY,
    tolerance: tearTolerance(geometry.height),
  });

  useEffect(() => {
    tearEnabled.set(canTear ? 1 : 0);
  }, [canTear, tearEnabled]);

  // Where the pack sits inside the gesture area (the whole stage, so a cut can start anywhere).
  const onPackLayout = (event: LayoutChangeEvent) => {
    const { x, y } = event.nativeEvent.layout;
    tearArea.set({ left: x, top: y, width: packWidth, seamY: geometry.seamY, tolerance: tearTolerance(geometry.height) });
  };

  const onTorn = () => {
    playSound('tear');
    haptics.flipRare();
    setTimeout(() => setPhase('stack'), reduceMotion ? 0 : STACK_DELAY_MS);
  };

  const finishTear = () => {
    'worklet';
    if (torn.get() === 1) return;
    torn.set(1);
    cutFrom.set(withTiming(0, reduceMotion ? instant : { duration: 120 }));
    cutTo.set(withTiming(1, reduceMotion ? instant : { duration: 120 }));
    stripFlight.set(withTiming(1, reduceMotion ? instant : { duration: 480, easing: Easing.out(Easing.cubic) }));
    packDrop.set(
      reduceMotion ? withTiming(1, instant) : withDelay(380, withTiming(1, { duration: 520, easing: Easing.in(Easing.cubic) })),
    );
    scheduleOnRN(onTorn);
  };

  const tickHaptic = () => haptics.tearTick();

  const blade = usePanGesture({
    minDistance: 0,
    onBegin: (event) => {
      tearState.set(initialTearState());
      lastTick.set(0);
      if (tearEnabled.get() === 1 && torn.get() === 0) tearState.set(tearStep(initialTearState(), event.x, event.y, tearArea.get()));
    },
    onUpdate: (event) => {
      const area = tearArea.get();
      if (tearEnabled.get() === 1 && torn.get() === 0) {
        const next = tearStep(tearState.get(), event.x, event.y, area);
        tearState.set(next);
        if (next.active === 1) {
          cutFrom.set(next.from / area.width);
          cutTo.set(next.to / area.width);
          if (next.direction !== 0) cutDirection.set(next.direction);
          const coverage = tearCoverage(next, area.width);
          const tick = Math.floor(coverage / TEAR_TICK);
          if (tick > lastTick.get()) {
            lastTick.set(tick);
            scheduleOnRN(tickHaptic);
          }
          if (coverage >= TEAR_COMPLETE) finishTear();
          return;
        }
      }
      // Not cutting: the finger tilts the pack.
      panX.set(clampUnit(event.translationX / PAN_TILT_DISTANCE));
      panY.set(clampUnit(event.translationY / PAN_TILT_DISTANCE));
    },
    onFinalize: () => {
      if (torn.get() === 0) {
        const outcome = tearRelease(tearState.get(), tearArea.get().width);
        if (outcome === 'complete') finishTear();
        else if (outcome === 'snapBack') {
          const middle = (cutFrom.get() + cutTo.get()) / 2;
          cutFrom.set(withSpring(middle, springs.gentle));
          cutTo.set(withSpring(middle, springs.gentle));
        }
      }
      tearState.set(initialTearState());
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
        <PressableScale accessibilityRole="button" accessibilityLabel={t('common.close')} hitSlop={12} onPress={() => router.back()}>
          <Icon name="close" size={30} />
        </PressableScale>
      </View>

      {phase === 'ready' ? (
        <>
          <GestureDetector gesture={blade}>
            <View style={styles.stage}>
              <Animated.View style={dropStyle} onLayout={onPackLayout}>
                <View
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
                    tearFrom={cutFrom}
                    tearTo={cutTo}
                    tearDirection={cutDirection}
                    stripFlight={stripFlight}
                    showPerforation={canTear}
                  />
                </View>
              </Animated.View>
            </View>
          </GestureDetector>

          <View style={styles.footer}>
            {attempt.isError ? (
              <>
                <Body align="center">{describeError(attempt.error, t)}</Body>
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
      ) : result && phase === 'stack' ? (
        <RevealStack cards={result.cards} cardWidth={Math.round(Math.min(screenWidth * 0.74, 300))} onDone={() => setPhase('recap')} />
      ) : result && phase === 'recap' ? (
        <PackRecap result={result} onOpenAnother={onOpenAnother} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { flexDirection: 'row', paddingHorizontal: spacing.md, paddingTop: spacing.xs },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  footer: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, minHeight: 120 },
  preparing: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
});
