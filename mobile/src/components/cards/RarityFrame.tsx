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

import { GOLD, isPremium } from './finishes';

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

/** Engraved antique gold of the art pack (rims, hairlines, filigree). */
const ENGRAVED_GOLD = '#C9A227';
const ENGRAVED_GOLD_LIGHT = '#E7C766';
/** Black lacquer band used by every rarity below legendary. */
const LACQUER = ['#1E2330', '#0B0E15', '#171B26'] as const;

/** Filigree scroll in one corner, mirrored to the four corners of premium frames. */
function cornerOrnament(size: number): string {
  const s = size;
  return [
    `M0 ${s} C0 ${s * 0.45} ${s * 0.45} 0 ${s} 0`,
    `M${s * 0.18} ${s} C${s * 0.18} ${s * 0.58} ${s * 0.58} ${s * 0.18} ${s} ${s * 0.18}`,
    `M${s * 0.32} ${s * 0.32} m-${s * 0.09} 0 a${s * 0.09} ${s * 0.09} 0 1 0 ${s * 0.18} 0 a${s * 0.09} ${s * 0.09} 0 1 0 -${s * 0.18} 0`,
  ].join(' ');
}

export const RarityFrame = memo(function RarityFrame({ rarity, finish, width, height, radius, frame, animated }: RarityFrameProps) {
  const style = rarityStyles[rarity];
  const gold = finish === 'gold';
  const fullArt = finish === 'full_art';
  const premium = isPremium(rarity);
  // Epic and better get the engraved gold filigree corners.
  const ornate = premium || rarity === 'epic';
  // Below legendary the band is black lacquer and the rarity color becomes an inner keyline.
  const lacquer = !gold && !premium;
  const progress = useSharedValue(0);
  // Gold prints and premium rarities have a living frame; others stay still.
  const runs = animated && (style.animated || gold);

  useEffect(() => {
    if (!runs) return;
    progress.set(withRepeat(withTiming(1, { duration: rarity === 'mythic' && !gold ? 4200 : 2600, easing: Easing.linear }), -1));
    return () => cancelAnimation(progress);
  }, [runs, rarity, gold, progress]);

  const shineStart = useDerivedValue(() => vec(-width + progress.get() * width * 3, 0));
  const shineEnd = useDerivedValue(() => vec(progress.get() * width * 3, height));
  const prismTransform = useDerivedValue(() => [{ rotate: progress.get() * Math.PI * 2 }]);

  const frameWidth = fullArt ? Math.max(2, Math.round(frame * 0.6)) : frame;
  const inner = { x: frameWidth, y: frameWidth, width: width - frameWidth * 2, height: height - frameWidth * 2 };
  const innerRadius = Math.max(2, radius - frameWidth * 0.6);
  const ornamentSize = Math.max(8, width * 0.12);
  const ornament = useMemo(() => cornerOrnament(ornamentSize), [ornamentSize]);
  const ornamentStroke = Math.max(0.6, width / 280);
  const edge = gold ? GOLD.edge : lacquer ? style.color : style.edge;
  const ruleInset = Math.max(1, frameWidth * 0.18);
  const ruleStroke = Math.max(0.6, width / 320);
  const corners: { x: number; y: number; scaleX: number; scaleY: number }[] = [
    { x: inner.x + 2, y: inner.y + 2, scaleX: 1, scaleY: 1 },
    { x: inner.x + inner.width - 2, y: inner.y + 2, scaleX: -1, scaleY: 1 },
    { x: inner.x + 2, y: inner.y + inner.height - 2, scaleX: 1, scaleY: -1 },
    { x: inner.x + inner.width - 2, y: inner.y + inner.height - 2, scaleX: -1, scaleY: -1 },
  ];

  return (
    <Canvas style={{ position: 'absolute', width, height }} pointerEvents="none">
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
        ) : lacquer ? (
          <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[...LACQUER]} />
        ) : (
          <LinearGradient start={vec(0, 0)} end={vec(width, height)} colors={[...style.gradient]} />
        )}
      </RoundedRect>
      {/* Banknote double rule: an outer gold hairline and a finer one inside the band. */}
      <RoundedRect
        x={ruleInset}
        y={ruleInset}
        width={width - ruleInset * 2}
        height={height - ruleInset * 2}
        r={Math.max(2, radius - ruleInset)}
        color={ENGRAVED_GOLD}
        style="stroke"
        strokeWidth={ruleStroke}
        opacity={lacquer ? 0.85 : 0.6}
      />
      {lacquer && frameWidth >= 5 ? (
        <RoundedRect
          x={frameWidth * 0.55}
          y={frameWidth * 0.55}
          width={width - frameWidth * 1.1}
          height={height - frameWidth * 1.1}
          r={Math.max(2, radius - frameWidth * 0.55)}
          color={ENGRAVED_GOLD}
          style="stroke"
          strokeWidth={ruleStroke * 0.6}
          opacity={0.45}
        />
      ) : null}
      {runs && (rarity === 'legendary' || gold || rarity === 'mythic') ? (
        <Group blendMode="screen">
          <RoundedRect x={0} y={0} width={width} height={height} r={radius}>
            <LinearGradient
              start={shineStart}
              end={shineEnd}
              colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
              positions={[0.42, 0.5, 0.58]}
            />
          </RoundedRect>
        </Group>
      ) : null}
      {/* Full art prints let the illustration fill the face: no solid face behind it. */}
      {fullArt ? null : <RoundedRect {...inner} r={innerRadius} color={CARD_FACE} />}
      {gold && !fullArt ? <EmbossTexture inner={inner} radius={innerRadius} /> : null}
      <RoundedRect {...inner} r={innerRadius} color={edge} style="stroke" strokeWidth={Math.max(1, frameWidth * (lacquer ? 0.3 : 0.25))} />
      {ornate || gold
        ? corners.map((corner, index) => (
            <Group
              key={index}
              transform={[{ translateX: corner.x }, { translateY: corner.y }, { scaleX: corner.scaleX }, { scaleY: corner.scaleY }]}
            >
              {/* Embossed: dark stroke offset down-right under a light stroke. */}
              <Group transform={[{ translateX: 0.8 }, { translateY: 0.8 }]}>
                <Path path={ornament} style="stroke" strokeWidth={ornamentStroke * 1.6} color={CARD_INK} opacity={0.55} />
              </Group>
              <Path path={ornament} style="stroke" strokeWidth={ornamentStroke * 1.6} color={gold ? GOLD.base : ENGRAVED_GOLD} />
              <Path path={ornament} style="stroke" strokeWidth={ornamentStroke * 0.6} color={ENGRAVED_GOLD_LIGHT} opacity={0.7} />
            </Group>
          ))
        : null}
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
