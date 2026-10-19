import {
  Canvas,
  Group,
  LinearGradient,
  Path,
  RoundedRect,
  SweepGradient,
  rect,
  rrect,
  vec,
} from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import {
  cancelAnimation,
  Easing,
  useDerivedValue,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { palettes } from '@/theme/colors';
import { rarityStyles, type Rarity } from '@/theme/rarity';
import type { CardFinish } from '@/types/card';

import { GOLD } from './finishes';

/** Card faces stay ink-dark in both themes: a card is a physical object, not app chrome. */
export const CARD_FACE = palettes.dark.surface;
export const CARD_INK = palettes.dark.background;
export const CARD_PAPER = palettes.dark.text;
export const CARD_MUTED = palettes.dark.textMuted;

type RarityFrameProps = {
  rarity: Rarity;
  finish: CardFinish;
  width: number;
  height: number;
  radius: number;
  frame: number;
  /** Runs the shine sweep / prism rotation. Off for grids and sober cards. */
  animated: boolean;
};

export const RarityFrame = memo(function RarityFrame({ rarity, finish, width, height, radius, frame, animated }: RarityFrameProps) {
  const style = rarityStyles[rarity];
  const gold = finish === 'gold';
  const fullArt = finish === 'full_art';
  const progress = useSharedValue(0);
  // Gold prints and premium rarities have a living frame; others keep a static gloss.
  const runs = animated && (style.animated || gold);

  useEffect(() => {
    if (!runs) return;
    progress.set(withRepeat(withTiming(1, { duration: rarity === 'mythic' && !gold ? 4200 : 2600, easing: Easing.linear }), -1));
    return () => cancelAnimation(progress);
  }, [runs, rarity, gold, progress]);

  const shineStart = useDerivedValue(() => vec(-width + progress.get() * width * 3, 0));
  const shineEnd = useDerivedValue(() => vec(progress.get() * width * 3, height));
  const prismTransform = useDerivedValue(() => [{ rotate: progress.get() * Math.PI * 2 }]);

  // Every dimension follows the card width (see cardMetrics): the frame is identical at any size.
  const unit = width / 300;
  const frameWidth = fullArt ? frame * 0.66 : frame;
  const inner = { x: frameWidth, y: frameWidth, width: width - frameWidth * 2, height: height - frameWidth * 2 };
  const innerRadius = Math.max(1, radius - frameWidth * 0.6);
  const keyline = 2 * unit;
  const edge = gold ? GOLD.edge : style.edge;
  const markSize = 14 * unit;

  return (
    <Canvas style={{ position: 'absolute', width, height }} pointerEvents="none">
      {/* Bold rarity band, Ultimate Team style. */}
      <RoundedRect x={0} y={0} width={width} height={height} r={radius}>
        {gold ? (
          <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[...GOLD.gradient]} />
        ) : rarity === 'mythic' ? (
          <SweepGradient
            c={vec(width / 2, height / 2)}
            colors={[...style.gradient, style.gradient[0]]}
            transform={prismTransform}
            origin={vec(width / 2, height / 2)}
          />
        ) : (
          <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[...style.gradient]} />
        )}
      </RoundedRect>
      {/* Static gloss: a light from the top-left on every card, so thumbs shine like the hero. */}
      <RoundedRect x={0} y={0} width={width} height={height} r={radius}>
        <LinearGradient
          start={vec(0, 0)}
          end={vec(width * 0.7, height * 0.5)}
          colors={['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.08)', 'rgba(255,255,255,0)']}
          positions={[0, 0.45, 1]}
        />
      </RoundedRect>
      {runs ? (
        <Group blendMode="screen">
          <RoundedRect x={0} y={0} width={width} height={height} r={radius}>
            <LinearGradient
              start={shineStart}
              end={shineEnd}
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.8)', 'rgba(255,255,255,0)']}
              positions={[0.42, 0.5, 0.58]}
            />
          </RoundedRect>
        </Group>
      ) : null}
      {/* Full art prints let the illustration fill the face: no solid face behind it. */}
      {fullArt ? null : <RoundedRect {...inner} r={innerRadius} color={CARD_FACE} />}
      {gold && !fullArt ? <EmbossTexture inner={inner} radius={innerRadius} /> : null}
      <RoundedRect {...inner} r={innerRadius} color={edge} style="stroke" strokeWidth={keyline} />
      {/* Small rarity mark in the top-right corner of the band. */}
      <RoundedRect
        x={width - frameWidth / 2 - markSize / 2}
        y={frameWidth / 2 - markSize / 2 + markSize * 0.15}
        width={markSize}
        height={markSize}
        r={markSize / 2}
        color={gold ? GOLD.base : style.color}
      />
      <RoundedRect
        x={width - frameWidth / 2 - markSize / 2}
        y={frameWidth / 2 - markSize / 2 + markSize * 0.15}
        width={markSize}
        height={markSize}
        r={markSize / 2}
        color="rgba(255,255,255,0.9)"
        style="stroke"
        strokeWidth={1.5 * unit}
      />
    </Canvas>
  );
});

type EmbossTextureProps = {
  inner: { x: number; y: number; width: number; height: number };
  radius: number;
};

/** Fine embossed diagonal lines on gold prints, like a stamped metal plate. */
function EmbossTexture({ inner, radius }: EmbossTextureProps) {
  const path = useMemo(() => {
    const parts: string[] = [];
    const step = 6;
    for (let offset = -inner.height; offset < inner.width; offset += step) {
      parts.push(`M${inner.x + offset} ${inner.y + inner.height} L${inner.x + offset + inner.height} ${inner.y}`);
    }
    return parts.join(' ');
  }, [inner.x, inner.y, inner.width, inner.height]);
  const clip = useMemo(
    () => rrect(rect(inner.x, inner.y, inner.width, inner.height), radius, radius),
    [inner.x, inner.y, inner.width, inner.height, radius],
  );
  return (
    <Group clip={clip}>
      <Path path={path} style="stroke" strokeWidth={1} color={GOLD.glint} opacity={0.06} />
      <Group transform={[{ translateX: 1 }]}>
        <Path path={path} style="stroke" strokeWidth={1} color="#000000" opacity={0.18} />
      </Group>
    </Group>
  );
}
