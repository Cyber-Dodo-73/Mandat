import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { radius, useTheme } from '@/theme';
import { instant, springs } from '@/theme/motion';

type ProgressBarProps = {
  /** Between 0 and 1. */
  progress: number;
  color?: string;
  height?: number;
  accessibilityLabel?: string;
};

export function ProgressBar({ progress, color, height = 16, accessibilityLabel }: ProgressBarProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const clamped = Math.min(1, Math.max(0, progress));
  const fill = useSharedValue(clamped);

  useEffect(() => {
    fill.set(reduceMotion ? withTiming(clamped, instant) : withSpring(clamped, springs.gentle));
  }, [clamped, fill, reduceMotion]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${fill.get() * 100}%` }));

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, backgroundColor: colors.surfaceRaised }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color ?? colors.brand }, fillStyle]}>
        <View style={[styles.highlight, { height: height / 3 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { width: '100%', borderRadius: radius, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius },
  highlight: {
    marginTop: 3,
    marginHorizontal: 6,
    borderRadius: radius,
    backgroundColor: 'rgba(255, 255, 255, 0.28)',
  },
});
