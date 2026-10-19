import { Canvas, Path } from '@shopify/react-native-skia';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View, type ImageSourcePropType } from 'react-native';

import type { Card } from '@/types/card';

import { engravingPaths } from './engraving';
import { GOLD } from './finishes';
import { flagPalette } from './flagColors';

const PAPER = '#F1E8D4';
const INK = '#0A0D14';

/** Faces sit in the upper part of portraits: keep them in frame when cropping. */
const FOCAL_POINT = { top: '22%', left: '50%' } as const;

type PortraitArtworkProps = {
  card: Card;
  source: ImageSourcePropType;
  width: number;
  height: number;
  /** Full art prints: denser engraving over the whole face. */
  fullBleed?: boolean;
  /** Gold prints: the photo is recolored to gold. */
  gold?: boolean;
  /** Large cards add the engraved overlay; thumbs stay a single cached image. */
  engraved?: boolean;
};

/**
 * Real portrait (Wikimedia Commons) printed like the rest of the card: a light flag-colored
 * wash and a dark falloff for the text. Every figure gets the same treatment.
 */
export const PortraitArtwork = memo(function PortraitArtwork({
  card,
  source,
  width,
  height,
  fullBleed = false,
  gold = false,
  engraved = false,
}: PortraitArtworkProps) {
  const palette = flagPalette(card.country, card.continent);

  return (
    <View style={[styles.root, { width, height }]} pointerEvents="none">
      <Image
        source={source as ImageSource}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        contentPosition={FOCAL_POINT}
        cachePolicy="memory-disk"
        transition={0}
        recyclingKey={card.id}
        accessible={false}
      />

      {gold ? (
        <View style={[StyleSheet.absoluteFill, styles.gold]} />
      ) : (
        <View style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: palette.primary }]} />
      )}

      {engraved ? <Engraving card={card} width={width} height={height} fullBleed={fullBleed} /> : null}

      <LinearGradient
        colors={['rgba(11,15,26,0)', fullBleed ? 'rgba(11,15,26,0.7)' : 'rgba(11,15,26,0.45)']}
        start={{ x: 0.5, y: fullBleed ? 0.45 : 0.6 }}
        end={{ x: 0.5, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
});

function Engraving({ card, width, height, fullBleed }: { card: Card; width: number; height: number; fullBleed: boolean }) {
  const paths = engravingPaths(card.era, width, height);
  const strokeWidth = Math.max(0.5, width / 260);
  return (
    <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
      <Path path={paths.rosette} style="stroke" strokeWidth={strokeWidth} color={PAPER} opacity={fullBleed ? 0.14 : 0.1} />
      <Path path={paths.motif} style="stroke" strokeWidth={strokeWidth * 1.4} color={PAPER} opacity={0.36} />
    </Canvas>
  );
}

const styles = StyleSheet.create({
  // Blend modes below only mix with the photo, never with the card frame behind it.
  root: { overflow: 'hidden', isolation: 'isolate', backgroundColor: INK },
  gold: { backgroundColor: GOLD.base, mixBlendMode: 'color', opacity: 0.85 },
  tint: { mixBlendMode: 'soft-light', opacity: 0.3 },
});
