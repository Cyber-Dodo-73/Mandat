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
import { rarityStyles, type Rarity } from '@/theme/rarity';
import type { CardFinish } from '@/types/card';

import { cardMetrics, type CardSize } from './cardMetrics';
import { guillochePath } from './engraving';
import { GOLD } from './finishes';
import { CARD_INK, CARD_PAPER } from './RarityFrame';

const ACCENT = palettes.dark.accent;

type CardBackProps = {
  size?: CardSize;
  width?: number;
  /**
   * Hints the rarity with a pulsing glow before the flip (the suspense on the last card).
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

  useEffect(() => {
    if (!glow || reduceMotion) return;
    pulse.set(withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true));
    return () => cancelAnimation(pulse);
  }, [glow, reduceMotion, pulse]);

  const glowColor = glow ? rarityStyles[glow].glow.color : 'transparent';
  const gold = finish === 'gold';
  const iridescent = finish === 'holo' || finish === 'full_art';
  const keylineColor = gold ? GOLD.base : glow ? glowColor : CARD_PAPER;
  const sealColor = gold ? GOLD.base : ACCENT;
  const glowStyle = useAnimatedStyle(() => ({
    shadowOpacity: glow ? 0.55 + pulse.get() * 0.45 : 0,
    shadowRadius: glow ? 14 + pulse.get() * 16 : 0,
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
          opacity={glow || gold || iridescent ? 0.9 : 0.35}
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
