import { Canvas, Path, RoundedRect, SweepGradient, vec } from '@shopify/react-native-skia';
import { memo, useEffect, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';

import { APP_NAME } from '@/constants/app';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { fontFamilies } from '@/theme';
import { palettes } from '@/theme/colors';
import { rarityRank, rarityStyles, type Rarity } from '@/theme/rarity';
import type { CardFinish } from '@/types/card';

import { cardMetrics, type CardSize } from './cardMetrics';
import { guillochePath } from './engraving';
import { GOLD } from './finishes';
import { CARD_INK, CARD_PAPER } from './RarityFrame';

const ACCENT = palettes.dark.accent;

type GlowLevel = { opacity: number; radius: number; pulse: number; pulseMs: number; prismatic: boolean };

/** Suspense on the face-down card, by rarity rank: subtle rare, strong epic, pulsing legendary, prismatic mythic. */
const GLOW_LEVELS: readonly (GlowLevel | null)[] = [
  null,
  null,
  { opacity: 0.4, radius: 10, pulse: 0, pulseMs: 0, prismatic: false },
  { opacity: 0.7, radius: 18, pulse: 0.15, pulseMs: 1200, prismatic: false },
  { opacity: 0.55, radius: 16, pulse: 0.45, pulseMs: 800, prismatic: false },
  { opacity: 0.6, radius: 18, pulse: 0.4, pulseMs: 650, prismatic: true },
];

type CardBackProps = {
  size?: CardSize;
  width?: number;
  /**
   * Hints the rarity with a glow before the flip (the suspense). Ignored for commons and
   * uncommons; grows from a subtle rare halo to a pulsing, prismatic mythic one.
   */
  glow?: Rarity;
  /**
   * Print version, when the caller wants the back to give it away: gold prints get a gold
   * seal and keyline, holo and full art an iridescent keyline.
   */
  finish?: CardFinish;
};

/** MANDAT card back: ink, a red guilloché seal and the wordmark. */
export const CardBack = memo(function CardBack({ size = 'large', width, glow, finish = 'standard' }: CardBackProps) {
  const { t } = useTranslation();
  const metrics = cardMetrics(size, width);
  const reduceMotion = useReduceMotion();
  const pulse = useSharedValue(0);
  const { width: w, height: h, radius, frame } = metrics;

  const seal = useMemo(() => guillochePath(w / 2, h / 2, w * 0.36, 16, 3), [w, h]);
  const outerSeal = useMemo(() => guillochePath(w / 2, h / 2, w * 0.46, 28, 1), [w, h]);

  // Commons and uncommons never glow: only rare and better cards give themselves away.
  const level = glow ? GLOW_LEVELS[rarityRank(glow)] : null;
  const pulses = Boolean(level?.pulse) && !reduceMotion;

  useEffect(() => {
    if (!pulses) return;
    pulse.set(withRepeat(withTiming(1, { duration: level?.pulseMs ?? 900, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [level?.pulseMs, pulses, pulse]);

  const glowColor = level && glow ? rarityStyles[glow].glow.color : 'transparent';
  const gold = finish === 'gold';
  const prismatic = level?.prismatic === true;
  const iridescent = finish === 'holo' || finish === 'full_art' || prismatic;
  const keylineColor = gold ? GOLD.base : level ? glowColor : CARD_PAPER;
  const sealColor = gold ? GOLD.base : ACCENT;
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: level ? level.opacity + pulse.get() * level.pulse : 0,
    shadowRadius: level ? level.radius + pulse.get() * level.pulse * 30 : 0,
  }));

  return (
    <Animated.View
      accessible
      accessibilityRole="image"
      accessibilityLabel={t('cards.backA11y')}
      style={[{ width: w, height: h, borderRadius: radius, shadowColor: glowColor, shadowOffset: { width: 0, height: 0 } }, glowStyle]}
    >
      <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
        <RoundedRect x={0} y={0} width={w} height={h} r={radius} color={CARD_INK} />
        <RoundedRect
          x={frame}
          y={frame}
          width={w - frame * 2}
          height={h - frame * 2}
          r={Math.max(2, radius - frame * 0.6)}
          color={keylineColor}
          style="stroke"
          strokeWidth={Math.max(1, frame * (iridescent || gold ? 0.5 : 0.35))}
          opacity={level || gold || iridescent ? 0.9 : 0.35}
        >
          {iridescent ? <SweepGradient c={vec(w / 2, h / 2)} colors={[...rarityStyles.mythic.gradient, rarityStyles.mythic.gradient[0]]} /> : null}
        </RoundedRect>
        <Path path={outerSeal} style="stroke" strokeWidth={Math.max(0.5, w / 400)} color={CARD_PAPER} opacity={0.18} />
        <Path path={seal} style="stroke" strokeWidth={Math.max(0.6, w / 300)} color={sealColor} opacity={0.85} />
      </Canvas>
      <View style={styles.center} pointerEvents="none">
        <Text
          allowFontScaling={false}
          style={[styles.wordmark, { fontSize: w * 0.13, letterSpacing: w * 0.012, paddingHorizontal: w * 0.04 }]}
        >
          {APP_NAME}
        </Text>
      </View>
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  center: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  wordmark: {
    fontFamily: fontFamilies.displayHeavy,
    color: CARD_PAPER,
    backgroundColor: CARD_INK,
  },
});
