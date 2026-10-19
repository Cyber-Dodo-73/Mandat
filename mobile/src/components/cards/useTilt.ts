import { DeviceMotion } from 'expo-sensors';
import { useEffect } from 'react';
import type { ViewStyle } from 'react-native';
import { usePanGesture, type PanGesture } from 'react-native-gesture-handler';
import {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  type DerivedValue,
} from 'react-native-reanimated';

import type { Tilt } from './HoloLayer';

/** Max card rotation, in degrees, at full tilt. */
const MAX_ROTATION = 14;
/** Phone rotation (radians) that maps to full tilt. */
const GYRO_RANGE = 0.45;
/** Low-pass filter weight for gyroscope readings: lower is smoother. */
const GYRO_SMOOTHING = 0.18;

const SPRING_BACK = { damping: 14, stiffness: 140, mass: 0.8 };

const clamp = (value: number) => {
  'worklet';
  return Math.max(-1, Math.min(1, value));
};

type UseTiltOptions = {
  /** Card width, used to scale the drag distance. */
  width: number;
  /** Pan to rotate the card in 3D, springing back on release. */
  pan: boolean;
  /** Follow the phone's orientation (large and hero cards only). */
  gyro: boolean;
  reduceMotion: boolean;
};

export type TiltControls = {
  /** Combined finger + phone tilt in [-1, 1], fed to the holo shader. */
  tilt: DerivedValue<Tilt>;
  gesture: PanGesture;
  /** 3D rotation style for the card container. */
  style: ReturnType<typeof useAnimatedStyle<ViewStyle>>;
};

export function useTilt({ width, pan, gyro, reduceMotion }: UseTiltOptions): TiltControls {
  const panX = useSharedValue(0);
  const panY = useSharedValue(0);
  const gyroX = useSharedValue(0);
  const gyroY = useSharedValue(0);

  const gyroEnabled = gyro && !reduceMotion;
  useEffect(() => {
    if (!gyroEnabled) return;
    let baseline: { beta: number; gamma: number } | null = null;
    let subscription: { remove: () => void } | null = null;
    let active = true;
    void DeviceMotion.isAvailableAsync().then((available) => {
      if (!available || !active) return;
      DeviceMotion.setUpdateInterval(16);
      subscription = DeviceMotion.addListener(({ rotation }) => {
        if (!rotation) return;
        // The orientation when the card appears is "flat": tilt is measured from there.
        baseline ??= { beta: rotation.beta, gamma: rotation.gamma };
        const targetX = clamp((rotation.gamma - baseline.gamma) / GYRO_RANGE);
        const targetY = clamp((rotation.beta - baseline.beta) / GYRO_RANGE);
        gyroX.set(gyroX.get() + (targetX - gyroX.get()) * GYRO_SMOOTHING);
        gyroY.set(gyroY.get() + (targetY - gyroY.get()) * GYRO_SMOOTHING);
      });
    });
    return () => {
      active = false;
      subscription?.remove();
      gyroX.set(withSpring(0, SPRING_BACK));
      gyroY.set(withSpring(0, SPRING_BACK));
    };
  }, [gyroEnabled, gyroX, gyroY]);

  const range = width * 0.6;
  const gesture = usePanGesture({
    enabled: pan && !reduceMotion,
    onUpdate: (event) => {
      panX.set(clamp(event.translationX / range));
      panY.set(clamp(event.translationY / range));
    },
    onFinalize: () => {
      panX.set(withSpring(0, SPRING_BACK));
      panY.set(withSpring(0, SPRING_BACK));
    },
  });

  const tilt = useDerivedValue<Tilt>(() => ({
    x: clamp(panX.get() + gyroX.get()),
    y: clamp(panY.get() + gyroY.get()),
  }));

  const style = useAnimatedStyle<ViewStyle>(() => {
    const current = tilt.get();
    return {
      transform: [
        { perspective: 900 },
        { rotateY: `${current.x * MAX_ROTATION}deg` },
        { rotateX: `${-current.y * MAX_ROTATION}deg` },
      ],
    };
  });

  return { tilt, gesture, style };
}
