import {
  Canvas,
  Circle,
  createPicture,
  Fill,
  Group,
  Path,
  Picture,
  RadialGradient,
  Skia,
  SweepGradient,
  vec,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import { rarityStyles, type Rarity } from '@/theme/rarity';

import { GOLD } from './finishes';
import type { RevealEffects as RevealEffectFlags } from './revealConfig';

/** Animated values driven by CardReveal, all in [0, 1] except the rays rotation (radians). */
export type RevealValues = {
  dim: SharedValue<number>;
  burst: SharedValue<number>;
  rays: SharedValue<number>;
  raysRotation: SharedValue<number>;
  prism: SharedValue<number>;
  particles: SharedValue<number>;
  /** Gold print beat: opacity of the gold rays. */
  gold: SharedValue<number>;
};

type EffectsProps = {
  rarity: Rarity;
  effects: RevealEffectFlags;
  values: RevealValues;
  width: number;
  height: number;
  /** Draws the gold rays of the gold print beat. */
  goldBeat?: boolean;
};

const DIM_COLOR = '#05070D';
const RAY_COUNT = 14;

function raysPath(cx: number, cy: number, radius: number): string {
  const parts: string[] = [];
  const half = Math.PI / RAY_COUNT / 2.4;
  for (let i = 0; i < RAY_COUNT; i += 1) {
    const angle = (i / RAY_COUNT) * Math.PI * 2;
    const x1 = cx + Math.cos(angle - half) * radius;
    const y1 = cy + Math.sin(angle - half) * radius;
    const x2 = cx + Math.cos(angle + half) * radius;
    const y2 = cy + Math.sin(angle + half) * radius;
    parts.push(`M${cx} ${cy} L${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} Z`);
  }
  return parts.join(' ');
}

/** Behind the card: dimmed surroundings, light rays, radial burst and prism ring. */
export const RevealBackdrop = memo(function RevealBackdrop({ rarity, effects, values, width, height, goldBeat = false }: EffectsProps) {
  const style = rarityStyles[rarity];
  const cx = width / 2;
  const cy = height / 2;
  const reach = Math.hypot(width, height) / 2;
  const rays = useMemo(() => raysPath(cx, cy, reach), [cx, cy, reach]);
  const prismColors = useMemo(() => [...rarityStyles.mythic.gradient, rarityStyles.mythic.gradient[0]], []);

  const dimOpacity = useDerivedValue(() => values.dim.get());
  const raysOpacity = useDerivedValue(() => values.rays.get() * 0.85);
  const raysTransform = useDerivedValue(() => [{ rotate: values.raysRotation.get() }]);
  const burstRadius = useDerivedValue(() => 40 + values.burst.get() * reach);
  const burstOpacity = useDerivedValue(() => (values.burst.get() > 0 ? 1 - values.burst.get() * 0.9 : 0));
  const prismRadius = useDerivedValue(() => 30 + values.prism.get() * reach * 1.1);
  const prismStroke = useDerivedValue(() => 6 + (1 - values.prism.get()) * 40);
  const prismOpacity = useDerivedValue(() => (values.prism.get() > 0 ? 1 - values.prism.get() : 0));
  const goldOpacity = useDerivedValue(() => values.gold.get() * 0.9);
  const goldTransform = useDerivedValue(() => [{ rotate: -values.raysRotation.get() * 1.4 }]);

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      {effects.dim ? <Fill color={DIM_COLOR} opacity={dimOpacity} /> : null}
      {effects.rays || effects.prism ? (
        <Group transform={raysTransform} origin={vec(cx, cy)} opacity={raysOpacity}>
          <Path path={rays}>
            {effects.prism ? (
              <SweepGradient c={vec(cx, cy)} colors={prismColors} />
            ) : (
              <RadialGradient c={vec(cx, cy)} r={reach} colors={[style.glow.color, `${style.color}00`]} />
            )}
          </Path>
        </Group>
      ) : null}
      {goldBeat ? (
        <Group transform={goldTransform} origin={vec(cx, cy)} opacity={goldOpacity}>
          <Path path={rays}>
            <RadialGradient c={vec(cx, cy)} r={reach} colors={[GOLD.glint, GOLD.base, `${GOLD.edge}00`]} />
          </Path>
        </Group>
      ) : null}
      {effects.burst ? (
        <Circle cx={cx} cy={cy} r={burstRadius} opacity={burstOpacity}>
          <RadialGradient c={vec(cx, cy)} r={reach} colors={[style.glow.color, `${style.color}00`]} />
        </Circle>
      ) : null}
      {effects.prism ? (
        <Circle cx={cx} cy={cy} r={prismRadius} style="stroke" strokeWidth={prismStroke} opacity={prismOpacity}>
          <SweepGradient c={vec(cx, cy)} colors={prismColors} />
        </Circle>
      ) : null}
    </Canvas>
  );
});

/** Small deterministic PRNG so a card always explodes the same way. */
function seededRandom(seed: number): () => number {
  let state = seed >>> 0 || 1;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type ParticlesProps = {
  rarity: Rarity;
  /** Overrides the rarity colors (gold particles of gold prints). */
  palette?: readonly string[];
  count: number;
  seed: number;
  progress: SharedValue<number>;
  width: number;
  height: number;
};

/** Particle explosion drawn above the card, recorded as one picture per frame on the UI thread. */
export const RevealParticles = memo(function RevealParticles({ rarity, palette, count, seed, progress, width, height }: ParticlesProps) {
  const particles = useMemo(() => {
    const random = seededRandom(seed);
    const angles: number[] = [];
    const speeds: number[] = [];
    const sizes: number[] = [];
    for (let i = 0; i < count; i += 1) {
      angles.push(random() * Math.PI * 2);
      speeds.push(0.3 + random() * 0.7);
      sizes.push(1.5 + random() * 3.5);
    }
    return { angles, speeds, sizes };
  }, [count, seed]);
  const colors = useMemo(() => [...(palette ?? rarityStyles[rarity].gradient), '#FFFFFF'], [palette, rarity]);

  const picture = useDerivedValue(() =>
    createPicture(
      (canvas) => {
        const p = progress.get();
        if (p <= 0 || p >= 1) return;
        const eased = 1 - (1 - p) * (1 - p);
        const reach = Math.max(width, height) * 0.62;
        const paint = Skia.Paint();
        for (let i = 0; i < particles.angles.length; i += 1) {
          const angle = particles.angles[i] ?? 0;
          const distance = (particles.speeds[i] ?? 0) * reach * eased;
          const x = width / 2 + Math.cos(angle) * distance;
          const y = height / 2 + Math.sin(angle) * distance + p * p * height * 0.18;
          paint.setColor(Skia.Color(colors[i % colors.length] ?? '#FFFFFF'));
          paint.setAlphaf(Math.max(0, 1 - p));
          canvas.drawCircle(x, y, (particles.sizes[i] ?? 2) * (1 - p * 0.4), paint);
        }
      },
      { width, height },
    ),
  );

  if (count === 0) return null;
  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Picture picture={picture} />
    </Canvas>
  );
});
