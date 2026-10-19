import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { Icon } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { useTheme } from '@/theme';

import type { FtueRect } from './anchors';

/** The cut runs across the top strip of the booster (see pack geometry). */
const CUT_LINE = 0.13;
const OVERSHOOT = 36;
const FINGER = 40;

/**
 * Animated finger sweeping across the booster's cut line, starting outside the pack like a
 * blade, with a glowing trail. Non-interactive: the real tear gesture stays underneath.
 */
export function BladeHint({ target }: { target: FtueRect }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 0.5 : 0);

  useEffect(() => {
    if (reduceMotion) return;
    progress.set(
      withRepeat(
        withSequence(
          withTiming(0, { duration: 0 }),
          withDelay(250, withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.cubic) })),
          withTiming(1, { duration: 450 }),
        ),
        -1,
      ),
    );
  }, [progress, reduceMotion]);

  const startX = target.x - OVERSHOOT;
  const span = target.width + OVERSHOOT * 2;
  const lineY = target.y + target.height * CUT_LINE;

  const finger = useAnimatedStyle(() => ({
    transform: [{ translateX: startX + progress.get() * span - FINGER / 2 }],
    opacity: reduceMotion ? 1 : Math.min(1, progress.get() * 6, (1 - progress.get()) * 6 + 0.2),
  }));
  const trail = useAnimatedStyle(() => ({ width: Math.max(0, progress.get() * span) }));

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none" accessibilityLabel={t('ftue.a11y.blade')} accessible>
      <Animated.View
        style={[styles.trail, { left: startX, top: lineY - 3, backgroundColor: colors.accent, shadowColor: colors.accent }, trail]}
      />
      <Animated.View style={[styles.finger, { top: lineY - 6 }, finger]}>
        <Icon name={reduceMotion ? 'arrow-forward-circle' : 'hand-left'} size={FINGER} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  trail: {
    position: 'absolute',
    height: 6,
    borderRadius: 3,
    opacity: 0.9,
    shadowOpacity: 1,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
  },
  finger: {
    position: 'absolute',
    left: 0,
    width: FINGER,
    height: FINGER,
    shadowColor: '#000',
    shadowOpacity: 0.5,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
  },
});
