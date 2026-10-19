import { Image, type ImageStyle } from 'expo-image';
import type { StyleProp } from 'react-native';

import { useTheme } from '@/theme';

const EMBLEM = require('../../../assets/brand/logo-emblem.webp') as number;
const WORDMARK_ON_DARK = require('../../../assets/brand/logo-wordmark.webp') as number;
const WORDMARK_ON_LIGHT = require('../../../assets/brand/logo-wordmark-dark.webp') as number;

/** Aspect ratio of the wordmark artwork (2400×600). */
const WORDMARK_RATIO = 4;

type EmblemProps = { size: number; style?: StyleProp<ImageStyle> };

/** The vermilion "M" wax seal from the art pack. */
export function Emblem({ size, style }: EmblemProps) {
  return (
    <Image
      source={EMBLEM}
      style={[{ width: size, height: size }, style]}
      contentFit="contain"
      accessible={false}
    />
  );
}

type WordmarkProps = { width: number; style?: StyleProp<ImageStyle>; accessibilityLabel?: string };

/** "MANDAT" logotype (Bricolage Grotesque ExtraBold), cream on dark themes, ink on light ones. */
export function Wordmark({ width, style, accessibilityLabel }: WordmarkProps) {
  const { scheme } = useTheme();
  return (
    <Image
      source={scheme === 'dark' ? WORDMARK_ON_DARK : WORDMARK_ON_LIGHT}
      style={[{ width, height: width / WORDMARK_RATIO }, style]}
      contentFit="contain"
      accessible={Boolean(accessibilityLabel)}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'header' : undefined}
    />
  );
}
