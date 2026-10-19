import {
  Canvas,
  Circle,
  DashPathEffect,
  Group,
  LinearGradient,
  Path,
  PathOp,
  RadialGradient,
  Rect,
  Skia,
} from '@shopify/react-native-skia';
import { useMemo, type ReactNode } from 'react';
import { StyleSheet } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import type { PackPalette } from '@/theme/packs';

import type { BoosterGeometry } from './geometry';

type BoosterArtProps = {
  geometry: BoosterGeometry;
  palette: PackPalette;
  /** Which side of the tear seam this canvas paints. */
  part: 'strip' | 'body';
  /** Tilt of the pack in [-1, 1]; drives the foil sheen and specular light. */
  tiltX: SharedValue<number>;
  tiltY: SharedValue<number>;
  /** Extra Skia nodes drawn on top (tear line, perforation). */
  children?: ReactNode;
};

const RIDGE_SPACING = 3;

/**
 * Procedural foil booster: a guilloche rosette and an official seal printed on
 * colored foil, heat-crimped at both ends. Drawn twice (strip and body) and clipped
 * on the seam, so the strip can be torn off without redrawing anything.
 */
export function BoosterArt({ geometry, palette, part, tiltX, tiltY, children }: BoosterArtProps) {
  const { width, height, crimp, outline, guilloche, rosetteCenter, rosetteRadius } = geometry;

  const clip = useMemo(() => {
    const partClip = part === 'strip' ? geometry.stripClip : geometry.bodyClip;
    return Skia.Path.MakeFromOp(outline, partClip, PathOp.Intersect) ?? outline;
  }, [geometry.bodyClip, geometry.stripClip, outline, part]);

  const ridges = useMemo(() => {
    const path = Skia.PathBuilder.Make();
    for (let x = RIDGE_SPACING; x < width; x += RIDGE_SPACING) {
      path.moveTo(x, 0);
      path.lineTo(x, crimp);
      path.moveTo(x, height - crimp);
      path.lineTo(x, height);
    }
    return path.detach();
  }, [crimp, height, width]);

  // The light band slides across the foil against the tilt, like a real metallic pouch.
  const sheenStart = useDerivedValue(() => ({ x: width * (-0.6 + tiltX.get() * 0.7), y: height * (-0.1 + tiltY.get() * 0.3) }));
  const sheenEnd = useDerivedValue(() => ({ x: width * (1.0 + tiltX.get() * 0.7), y: height * (1.1 + tiltY.get() * 0.3) }));
  const specularCenter = useDerivedValue(() => ({
    x: width * (0.5 - tiltX.get() * 0.55),
    y: height * (0.38 - tiltY.get() * 0.45),
  }));

  return (
    <Canvas style={[StyleSheet.absoluteFill, { width, height }]} pointerEvents="none">
      <Group clip={clip}>
        <Rect x={0} y={0} width={width} height={height}>
          <LinearGradient
            start={{ x: 0, y: 0 }}
            end={{ x: width, y: height }}
            colors={[palette.base, palette.deep, palette.base, palette.deep]}
            positions={[0, 0.45, 0.7, 1]}
          />
        </Rect>

        <Path path={guilloche} style="stroke" strokeWidth={0.7} color={palette.light} opacity={0.38} />

        <Circle cx={rosetteCenter.x} cy={rosetteCenter.y} r={rosetteRadius * 0.42} color={palette.deep} />
        <Circle
          cx={rosetteCenter.x}
          cy={rosetteCenter.y}
          r={rosetteRadius * 0.42}
          style="stroke"
          strokeWidth={2}
          color={palette.light}
        />
        <Circle
          cx={rosetteCenter.x}
          cy={rosetteCenter.y}
          r={rosetteRadius * 0.34}
          style="stroke"
          strokeWidth={1}
          color={palette.light}
          opacity={0.7}
        >
          <DashPathEffect intervals={[3, 3]} />
        </Circle>

        <Rect x={0} y={0} width={width} height={crimp} color={palette.deep} opacity={0.45} />
        <Rect x={0} y={height - crimp} width={width} height={crimp} color={palette.deep} opacity={0.45} />
        <Path path={ridges} style="stroke" strokeWidth={1} color={palette.light} opacity={0.22} />

        <Rect x={0} y={0} width={width} height={height} blendMode="screen">
          <LinearGradient
            start={sheenStart}
            end={sheenEnd}
            colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.42)', 'rgba(255,255,255,0)']}
            positions={[0.38, 0.5, 0.62]}
          />
        </Rect>
        <Rect x={0} y={0} width={width} height={height} blendMode="overlay">
          <RadialGradient c={specularCenter} r={width * 0.85} colors={['rgba(255,255,255,0.5)', 'rgba(255,255,255,0)']} />
        </Rect>

        <Path path={outline} style="stroke" strokeWidth={2} color={palette.deep} />
      </Group>
      {children}
    </Canvas>
  );
}
