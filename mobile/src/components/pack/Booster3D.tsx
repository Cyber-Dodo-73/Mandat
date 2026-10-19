import { Canvas, DashPathEffect, Path } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { Icon, Text } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { fontFamilies, spacing, useTheme } from '@/theme';
import { springs } from '@/theme/motion';
import type { PackPalette } from '@/theme/packs';

import { BoosterArt } from './BoosterArt';
import { boosterGeometry } from './geometry';

const MAX_ROTATE_Y = 18;
const MAX_ROTATE_X = 14;
const PERSPECTIVE = 900;
const BOB_DISTANCE = 7;
const BOB_DURATION = 1700;

export type Booster3DProps = {
  width: number;
  palette: PackPalette;
  /** Brand printed on the foil (APP_NAME). */
  wordmark: string;
  /** Short season line under the strip, e.g. "Saison 1". */
  seasonLabel: string;
  /** Pack name printed at the bottom, e.g. "Afrique". */
  title: string;
  accessibilityLabel: string;
  /** Tilt in [-1, 1] composed by the parent (gyroscope + finger). */
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  /** Idle floating bob. Ignored when reduce motion is on. */
  float?: boolean;
  /** Bouncy arrival when mounted. Ignored when reduce motion is on. */
  entrance?: boolean;
  /** Cut extent along the seam while the finger tears the strip, as fractions of the width (0 … 1). */
  tearFrom?: SharedValue<number>;
  tearTo?: SharedValue<number>;
  /** +1 / -1: side the strip flies off to (the way the finger cut). */
  tearDirection?: SharedValue<number>;
  /** 0 → 1 once torn: the strip flies off the pack. */
  stripFlight?: SharedValue<number>;
  /** Shows the dashed "tear here" seam. */
  showPerforation?: boolean;
  /** Locked packs stay visible but dimmed, with the unlock requirement. */
  lockedLabel?: string | null;
};

export function Booster3D({
  width,
  palette,
  wordmark,
  seasonLabel,
  title,
  accessibilityLabel,
  tiltX,
  tiltY,
  float = false,
  entrance = false,
  tearFrom,
  tearTo,
  tearDirection,
  stripFlight,
  showPerforation = false,
  lockedLabel = null,
}: Booster3DProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const geometry = useMemo(() => boosterGeometry(width), [width]);
  const { height, seamY, crimp, rosetteCenter, rosetteRadius } = geometry;

  const bob = useSharedValue(0);
  const arrival = useSharedValue(entrance && !reduceMotion ? 0 : 1);
  const zero = useSharedValue(0);
  const one = useSharedValue(1);
  const cutFrom = tearFrom ?? zero;
  const cutTo = tearTo ?? zero;
  const direction = tearDirection ?? one;
  const flight = stripFlight ?? zero;
  const cut = useDerivedValue(() => Math.max(0, cutTo.get() - cutFrom.get()));

  useEffect(() => {
    if (!entrance || reduceMotion) {
      arrival.set(1);
      return;
    }
    arrival.set(withSpring(1, springs.bounce));
  }, [arrival, entrance, reduceMotion]);

  useEffect(() => {
    if (!float || reduceMotion) {
      bob.set(withTiming(0, { duration: 200 }));
      return;
    }
    const ease = Easing.inOut(Easing.sin);
    bob.set(
      withDelay(
        400,
        withRepeat(
          withSequence(
            withTiming(-BOB_DISTANCE, { duration: BOB_DURATION, easing: ease }),
            withTiming(0, { duration: BOB_DURATION, easing: ease }),
          ),
          -1,
        ),
      ),
    );
  }, [bob, float, reduceMotion]);

  const packStyle = useAnimatedStyle(() => ({
    opacity: interpolate(arrival.get(), [0, 0.4], [0, 1], 'clamp'),
    transform: [
      { perspective: PERSPECTIVE },
      { translateY: bob.get() + (1 - arrival.get()) * 80 },
      { scale: 0.7 + arrival.get() * 0.3 },
      { rotateX: `${-tiltY.get() * MAX_ROTATE_X}deg` },
      { rotateY: `${tiltX.get() * MAX_ROTATE_Y}deg` },
    ],
  }));

  const shadowStyle = useAnimatedStyle(() => ({
    opacity: arrival.get() * (0.32 + bob.get() / (BOB_DISTANCE * 6)),
    transform: [{ scaleX: 1 + bob.get() / (BOB_DISTANCE * 8) - Math.abs(tiltX.get()) * 0.08 }],
  }));

  // The cut part peels up as the blade goes, then the strip flies off the way it was cut.
  const stripStyle = useAnimatedStyle(() => {
    const side = direction.get() < 0 ? -1 : 1;
    return {
      opacity: 1 - flight.get(),
      transform: [
        { translateX: side * flight.get() * width * 1.1 },
        { translateY: -cut.get() * 6 - flight.get() * height * 0.55 },
        { rotate: `${side * (-cut.get() * 7 + flight.get() * 38)}deg` },
      ],
    };
  });

  return (
    <View style={{ width, height: height + 28 }} accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <Animated.View
        style={[styles.shadow, { width: width * 0.8, left: width * 0.1, top: height + 6, backgroundColor: colors.shadow }, shadowStyle]}
      />
      <Animated.View style={[{ width, height }, packStyle]}>
        <View style={StyleSheet.absoluteFill}>
          <BoosterArt geometry={geometry} palette={palette} part="body" tiltX={tiltX} tiltY={tiltY} />

          <View style={[styles.line, { top: seamY + crimp * 0.4 }]}>
            <Text allowFontScaling={false} style={[styles.season, { color: palette.light }]}>
              {seasonLabel}
            </Text>
          </View>
          {/* The rosette's centre carries the engraved star seal (drawn in BoosterArt). */}
          <View style={[styles.line, { top: rosetteCenter.y + rosetteRadius + 6 }]}>
            <Text
              allowFontScaling={false}
              style={[styles.wordmark, { color: palette.light, fontSize: width * 0.15, lineHeight: width * 0.18 }]}
            >
              {wordmark}
            </Text>
          </View>
          <View style={[styles.line, { top: height - crimp - 30 }]}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.title, { color: palette.light }]}>
              {title}
            </Text>
          </View>
        </View>

        <Animated.View style={[StyleSheet.absoluteFill, styles.stripOrigin, stripStyle]} pointerEvents="none">
          <BoosterArt geometry={geometry} palette={palette} part="strip" tiltX={tiltX} tiltY={tiltY} />
        </Animated.View>

        {showPerforation || tearTo ? (
          <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
            {showPerforation ? (
              <>
                {/* Perforation still intact on both sides of the cut. */}
                <Path path={geometry.seam} style="stroke" strokeWidth={1.4} color={palette.light} opacity={0.7} start={0} end={cutFrom}>
                  <DashPathEffect intervals={[4, 4]} />
                </Path>
                <Path path={geometry.seam} style="stroke" strokeWidth={1.4} color={palette.light} opacity={0.7} start={cutTo} end={1}>
                  <DashPathEffect intervals={[4, 4]} />
                </Path>
              </>
            ) : null}
            {tearTo ? (
              <Path path={geometry.seam} style="stroke" strokeWidth={2.5} color={palette.light} start={cutFrom} end={cutTo} />
            ) : null}
          </Canvas>
        ) : null}

        {lockedLabel ? (
          <View style={[StyleSheet.absoluteFill, styles.locked, { backgroundColor: colors.overlay }]}>
            <Icon name="lock-closed" size={30} color={palette.light} />
            <Text variant="label" color={palette.light} align="center">
              {lockedLabel}
            </Text>
          </View>
        ) : null}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  shadow: { position: 'absolute', height: 16, borderRadius: 999 },
  line: { position: 'absolute', left: 0, right: 0, alignItems: 'center' },
  season: { fontFamily: fontFamilies.bodyBold, fontSize: 12, letterSpacing: 1.2 },
  wordmark: { fontFamily: fontFamilies.displayHeavy, letterSpacing: 3 },
  title: { fontFamily: fontFamilies.bodyBold, fontSize: 14 },
  stripOrigin: { transformOrigin: 'center top' },
  locked: { alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
});
