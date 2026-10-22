import { Canvas, Circle } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

type AuraParticlesProps = {
  width: number;
  height: number;
  colors: readonly string[];
  /** Number of motes; kept low, the aura must stay subtle. */
  count?: number;
};

/** Margin around the card where motes float. */
export const AURA_MARGIN = 22;
const CYCLE_MS = 5200;

/**
 * Subtle floating motes around premium cards (legendary, mythic, gold) in large sizes:
 * each mote rises along the card edge, fades in and out, then loops with its own phase.
 *
 * Every mote is a Skia node driven by plain numeric derived values: nothing is allocated per
 * frame. (Recording a picture per frame on the UI thread created Skia objects that the UI
 * runtime almost never collects: the app grew by megabytes per minute until iOS killed it.)
 */
export const AuraParticles = memo(function AuraParticles({ width, height, colors, count = 18 }: AuraParticlesProps) {
  const time = useSharedValue(0);
  const canvasWidth = width + AURA_MARGIN * 2;
  const canvasHeight = height + AURA_MARGIN * 2;

  useEffect(() => {
    time.set(withRepeat(withTiming(1, { duration: CYCLE_MS, easing: Easing.linear }), -1));
    return () => cancelAnimation(time);
  }, [time]);

  const motes = useMemo(() => {
    const result: { x: number; phase: number; size: number; color: string }[] = [];
    for (let i = 0; i < count; i += 1) {
      // Golden-ratio spacing keeps the motes evenly spread without randomness.
      const t = (i * 0.618034) % 1;
      // Motes hug the left and right edges, a few float across the top and bottom.
      const side = i % 3;
      result.push({
        x: side === 0 ? t * AURA_MARGIN : side === 1 ? canvasWidth - t * AURA_MARGIN : AURA_MARGIN + t * width,
        phase: (i * 0.37) % 1,
        size: 1 + ((i * 7) % 5) * 0.4,
        color: colors[i % colors.length] ?? '#FFFFFF',
      });
    }
    return result;
  }, [colors, count, canvasWidth, width]);

  return (
    <Canvas
      style={{ position: 'absolute', left: -AURA_MARGIN, top: -AURA_MARGIN, width: canvasWidth, height: canvasHeight }}
      pointerEvents="none"
    >
      {motes.map((mote, index) => (
        <Mote key={index} index={index} time={time} canvasHeight={canvasHeight} {...mote} />
      ))}
    </Canvas>
  );
});

type MoteProps = {
  index: number;
  time: SharedValue<number>;
  canvasHeight: number;
  x: number;
  phase: number;
  size: number;
  color: string;
};

function Mote({ index, time, canvasHeight, x, phase, size, color }: MoteProps) {
  const cy = useDerivedValue(() => canvasHeight - ((time.get() + phase) % 1) * canvasHeight);
  const cx = useDerivedValue(() => x + Math.sin(((time.get() + phase) % 1) * Math.PI * 2 + index) * 3);
  const opacity = useDerivedValue(() => Math.sin(((time.get() + phase) % 1) * Math.PI) * 0.75);
  return <Circle cx={cx} cy={cy} r={size} color={color} opacity={opacity} />;
}
