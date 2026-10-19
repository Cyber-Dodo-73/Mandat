import { Canvas, Fill, Group, Shader, Skia, rrect, rect } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
  type DerivedValue,
} from 'react-native-reanimated';

import type { Rarity } from '@/theme/rarity';
import type { CardFinish } from '@/types/card';

/**
 * One foil shader, three looks:
 * - rarity accent: a moving light spot with fine diagonal foil lines (rare and up);
 * - holo finish: full-card glitter sparkles and a cosmos texture under a broad rainbow sheen;
 * - gold finish: warm metallic glitter plus a glint sweeping across the card.
 * Everything follows the tilt, like a real card under a lamp.
 */
const FOIL_SHADER = Skia.RuntimeEffect.Make(`
uniform float2 size;
uniform float2 tilt;
uniform float intensity;
uniform float prism;
uniform float3 tint;
uniform float lines;
uniform float glitter;
uniform float glint;

float hash(float2 p) {
  return fract(sin(dot(p, float2(127.1, 311.7))) * 43758.5453);
}

half4 main(float2 pos) {
  float2 uv = pos / size;
  float2 light = float2(0.5 + tilt.x * 0.5, 0.42 + tilt.y * 0.5);
  float spot = smoothstep(0.8, 0.0, distance(uv, light));
  float band = (uv.x * 0.8 + uv.y * 1.2) * 2.0 + tilt.x * 1.8 - tilt.y * 1.2;
  float3 rainbow = 0.5 + 0.5 * cos(6.28318 * (band + float3(0.0, 0.33, 0.67)));
  float3 color = mix(tint, rainbow, prism);
  float sheen = 0.5 + 0.5 * sin(band * 3.14159);
  float foilLines = 0.5 + 0.5 * sin((uv.x - uv.y) * size.x * 0.8);

  float h = hash(floor(pos / 3.0));
  float twinkle = 0.5 + 0.5 * sin(h * 40.0 + tilt.x * 9.0 + tilt.y * 7.0);
  float spark = step(0.86, h) * pow(twinkle, 6.0);
  float cosmos = 0.5 + 0.5 * sin(uv.x * 23.0 + sin(uv.y * 17.0 + tilt.x * 2.0) * 2.0);

  float sweep = 0.0;
  if (glint > -1.5) {
    sweep = smoothstep(0.07, 0.0, abs((uv.x + uv.y) * 0.5 - glint));
  }

  float alpha = intensity * (0.55 * spot + lines * 0.3 * sheen * foilLines + glitter * (0.9 * spark + 0.2 * cosmos * sheen) + 0.05);
  alpha = clamp(alpha + sweep * 0.65, 0.0, 1.0);
  color = mix(color, float3(1.0), clamp(spark * glitter * 0.6 + sweep * 0.5, 0.0, 1.0));
  return half4(color * alpha, alpha);
}
`);

type FoilStyle = {
  intensity: number;
  prism: number;
  tint: readonly [number, number, number];
  lines: number;
  glitter: number;
  /** Animated glint sweep (gold finish). */
  glint: boolean;
};

/** Rarity accents: commons and uncommons have none; intensity grows with rarity, mythic is a full prism. */
const RARITY_FOIL: Partial<Record<Rarity, FoilStyle>> = {
  rare: { intensity: 0.3, prism: 0.35, tint: [0.75, 0.86, 1], lines: 1, glitter: 0, glint: false },
  epic: { intensity: 0.38, prism: 0.5, tint: [0.86, 0.74, 1], lines: 1, glitter: 0, glint: false },
  legendary: { intensity: 0.46, prism: 0.25, tint: [1, 0.86, 0.45], lines: 1, glitter: 0.25, glint: false },
  mythic: { intensity: 0.56, prism: 1, tint: [1, 1, 1], lines: 1, glitter: 0.35, glint: false },
};

const HOLO_FOIL: FoilStyle = { intensity: 0.5, prism: 0.95, tint: [0.9, 0.95, 1], lines: 0.35, glitter: 1, glint: false };
const GOLD_FOIL: FoilStyle = { intensity: 0.42, prism: 0.08, tint: [1, 0.83, 0.42], lines: 0.5, glitter: 0.8, glint: true };

/** Sensitive cards keep their finish, muted: silver, low intensity, no rainbow. */
function mute(style: FoilStyle): FoilStyle {
  return { ...style, intensity: style.intensity * 0.45, prism: 0, tint: [0.82, 0.82, 0.82], glitter: style.glitter * 0.5 };
}

export function foilStyle(rarity: Rarity, finish: CardFinish, sober: boolean): FoilStyle | null {
  if (finish === 'holo') return sober ? mute(HOLO_FOIL) : HOLO_FOIL;
  if (finish === 'gold') return sober ? mute(GOLD_FOIL) : GOLD_FOIL;
  const accent = RARITY_FOIL[rarity];
  if (!accent || sober) return null;
  // Full art prints carry a slightly stronger accent across the whole illustration.
  return finish === 'full_art' ? { ...accent, intensity: accent.intensity * 1.15 } : accent;
}

export type Tilt = { x: number; y: number };

type HoloLayerProps = {
  rarity: Rarity;
  finish: CardFinish;
  sober: boolean;
  width: number;
  height: number;
  radius: number;
  /** Live tilt in [-1, 1]; omitted for static cards (grids), which get a fixed sheen. */
  tilt?: DerivedValue<Tilt>;
  /** Runs the gold glint loop. Off for thumbnails. */
  animated: boolean;
};

const STATIC_TILT: Tilt = { x: 0.35, y: -0.25 };

export const HoloLayer = memo(function HoloLayer({ rarity, finish, sober, width, height, radius, tilt, animated }: HoloLayerProps) {
  const foil = foilStyle(rarity, finish, sober);
  const clip = useMemo(() => rrect(rect(0, 0, width, height), radius, radius), [width, height, radius]);
  const glint = useSharedValue(-2);
  const runsGlint = animated && foil?.glint === true;

  useEffect(() => {
    if (!runsGlint) return;
    glint.set(-0.4);
    glint.set(withRepeat(withDelay(1400, withTiming(1.4, { duration: 1300, easing: Easing.inOut(Easing.quad) })), -1));
    return () => cancelAnimation(glint);
  }, [runsGlint, glint]);

  const uniforms = useDerivedValue(() => {
    const current = tilt ? tilt.get() : STATIC_TILT;
    return {
      size: [width, height],
      tilt: [current.x, current.y],
      intensity: foil?.intensity ?? 0,
      prism: foil?.prism ?? 0,
      tint: foil?.tint ?? [1, 1, 1],
      lines: foil?.lines ?? 0,
      glitter: foil?.glitter ?? 0,
      glint: runsGlint ? glint.get() : -2,
    };
  });

  if (!foil || !FOIL_SHADER) return null;
  return (
    <Canvas style={{ position: 'absolute', width, height }} pointerEvents="none">
      <Group clip={clip}>
        <Fill>
          <Shader source={FOIL_SHADER} uniforms={uniforms} />
        </Fill>
      </Group>
    </Canvas>
  );
});
