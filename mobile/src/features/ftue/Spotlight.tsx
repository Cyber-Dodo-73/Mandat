import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { radius, useTheme } from '@/theme';

import type { FtueRect } from './anchors';

const PAD = 10;
const DIM = 'rgba(4, 6, 14, 0.62)';

type SpotlightProps = { target: FtueRect; layer: { width: number; height: number } };

/**
 * Dims everything around the target with a pulsing ring on it. Purely visual: touches go
 * through (the player is never blocked and can tap the target, or anything else).
 */
export function Spotlight({ target, layer }: SpotlightProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) return;
    pulse.set(withRepeat(withSequence(withTiming(1, { duration: 700 }), withTiming(0, { duration: 700 })), -1));
  }, [pulse, reduceMotion]);

  const ring = useAnimatedStyle(() => ({
    opacity: 1 - pulse.get() * 0.45,
    transform: [{ scale: 1 + pulse.get() * 0.04 }],
  }));

  const left = Math.max(0, target.x - PAD);
  const top = Math.max(0, target.y - PAD);
  const right = Math.min(layer.width, target.x + target.width + PAD);
  const bottom = Math.min(layer.height, target.y + target.height + PAD);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <View style={[styles.dim, { left: 0, right: 0, top: 0, height: top }]} />
      <View style={[styles.dim, { left: 0, right: 0, top: bottom, bottom: 0 }]} />
      <View style={[styles.dim, { left: 0, width: left, top, height: bottom - top }]} />
      <View style={[styles.dim, { left: right, right: 0, top, height: bottom - top }]} />
      <Animated.View
        style={[
          styles.ring,
          { left, top, width: right - left, height: bottom - top, borderColor: colors.accent, shadowColor: colors.accent },
          ring,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: DIM },
  ring: {
    position: 'absolute',
    borderWidth: 4,
    borderRadius: radius,
    shadowOpacity: 0.9,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 0 },
  },
});
