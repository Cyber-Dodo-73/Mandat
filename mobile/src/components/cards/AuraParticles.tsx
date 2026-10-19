import { Canvas, createPicture, Picture, Skia } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
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
    const xs: number[] = [];
    const phases: number[] = [];
    const sizes: number[] = [];
    for (let i = 0; i < count; i += 1) {
      // Golden-ratio spacing keeps the motes evenly spread without randomness.
      const t = (i * 0.618034) % 1;
      // Motes hug the left and right edges, a few float across the top and bottom.
      const side = i % 3;
      xs.push(side === 0 ? t * AURA_MARGIN : side === 1 ? canvasWidth - t * AURA_MARGIN : AURA_MARGIN + t * width);
      phases.push((i * 0.37) % 1);
      sizes.push(1 + ((i * 7) % 5) * 0.4);
    }
    return { xs, phases, sizes };
  }, [count, canvasWidth, width]);

  const picture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        const paint = Skia.Paint();
        for (let i = 0; i < motes.xs.length; i += 1) {
          const local = (time.get() + (motes.phases[i] ?? 0)) % 1;
          const y = canvasHeight - local * canvasHeight;
          const x = (motes.xs[i] ?? 0) + Math.sin(local * Math.PI * 2 + i) * 3;
          paint.setColor(Skia.Color(colors[i % colors.length] ?? '#FFFFFF'));
          paint.setAlphaf(Math.sin(local * Math.PI) * 0.75);
          canvas.drawCircle(x, y, motes.sizes[i] ?? 1.5, paint);
        }
      },
      { width: canvasWidth, height: canvasHeight },
    ),
  );

  return (
    <Canvas
      style={{ position: 'absolute', left: -AURA_MARGIN, top: -AURA_MARGIN, width: canvasWidth, height: canvasHeight }}
      pointerEvents="none"
    >
      <Picture picture={picture} />
    </Canvas>
  );
});
