import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { interpolate, useAnimatedStyle, type SharedValue } from 'react-native-reanimated';

type CardFlipProps = {
  /** 0 = back visible, 1 = front visible. Driven by the caller (tap, swipe or reveal). */
  progress: SharedValue<number>;
  /** Extra turn in degrees around the vertical axis (legendary and mythic spins). */
  spin?: SharedValue<number>;
  width: number;
  height: number;
  front: ReactNode;
  back: ReactNode;
};

/** 3D flip between two faces, entirely on the UI thread. */
export function CardFlip({ progress, spin, width, height, front, back }: CardFlipProps) {
  const backStyle = useAnimatedStyle(() => {
    const angle = interpolate(progress.get(), [0, 1], [0, 180]) + (spin?.get() ?? 0);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${angle}deg` }],
      opacity: isFacing(angle) ? 1 : 0,
    };
  });
  const frontStyle = useAnimatedStyle(() => {
    const angle = interpolate(progress.get(), [0, 1], [-180, 0]) + (spin?.get() ?? 0);
    return {
      transform: [{ perspective: 1000 }, { rotateY: `${angle}deg` }],
      opacity: isFacing(angle) ? 1 : 0,
    };
  });

  return (
    <View style={{ width, height }}>
      <Animated.View style={[StyleSheet.absoluteFill, backStyle]}>{back}</Animated.View>
      <Animated.View style={[StyleSheet.absoluteFill, frontStyle]}>{front}</Animated.View>
    </View>
  );
}

/** A face is visible while it points toward the viewer (backface culling done by hand). */
function isFacing(angle: number): boolean {
  'worklet';
  const normalized = ((angle % 360) + 360) % 360;
  return normalized < 90 || normalized > 270;
}
