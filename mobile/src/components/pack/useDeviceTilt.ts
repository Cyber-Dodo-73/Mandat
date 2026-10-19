import { DeviceMotion, type DeviceMotionMeasurement } from 'expo-sensors';
import { useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';

import { springs } from '@/theme/motion';

/** Phone rotation (radians) that maps to a full tilt of 1. */
const FULL_TILT_RAD = 0.35;
/** Low-pass factor applied to each sample: lower is smoother but laggier. */
const SMOOTHING = 0.18;
/** How fast the neutral pose follows the way the phone is held. */
const RECENTER = 0.012;
const UPDATE_INTERVAL_MS = 16;

const clamp = (value: number) => Math.max(-1, Math.min(1, value));

export type DeviceTilt = { x: SharedValue<number>; y: SharedValue<number> };

/**
 * Gyroscope tilt in [-1, 1] on both axes, relative to how the phone is held and
 * slowly re-centered. Listens only while the screen is focused and `enabled`
 * (pass false when reduce motion is on).
 */
export function useDeviceTilt(enabled: boolean): DeviceTilt {
  const x = useSharedValue(0);
  const y = useSharedValue(0);

  useFocusEffect(
    useCallback(() => {
      if (!enabled) return undefined;
      let subscription: { remove: () => void } | null = null;
      let cancelled = false;
      let neutral: { beta: number; gamma: number } | null = null;
      let smoothX = 0;
      let smoothY = 0;

      const onSample = ({ rotation }: DeviceMotionMeasurement) => {
        if (!rotation) return;
        if (!neutral) neutral = { beta: rotation.beta, gamma: rotation.gamma };
        neutral.beta += (rotation.beta - neutral.beta) * RECENTER;
        neutral.gamma += (rotation.gamma - neutral.gamma) * RECENTER;
        smoothX += (clamp((rotation.gamma - neutral.gamma) / FULL_TILT_RAD) - smoothX) * SMOOTHING;
        smoothY += (clamp((rotation.beta - neutral.beta) / FULL_TILT_RAD) - smoothY) * SMOOTHING;
        x.set(smoothX);
        y.set(smoothY);
      };

      DeviceMotion.isAvailableAsync()
        .then((available) => {
          if (!available || cancelled) return;
          DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);
          subscription = DeviceMotion.addListener(onSample);
        })
        // No motion sensor (simulator, restricted device): the pack just stays still.
        .catch(() => undefined);

      return () => {
        cancelled = true;
        subscription?.remove();
        x.set(withSpring(0, springs.gentle));
        y.set(withSpring(0, springs.gentle));
      };
    }, [enabled, x, y]),
  );

  return { x, y };
}
