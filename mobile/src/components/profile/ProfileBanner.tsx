import { Canvas, LinearGradient, Path, Rect, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui';
import { resolveCosmetic } from '@/features/profile/cosmetics';
import { radius, useTheme } from '@/theme';

import { wavesPath } from './guilloche';
import { tierPaint } from './tierColors';

export const BANNER_RATIO = 3;

type ProfileBannerProps = { id: string; width: number };

/**
 * 3:1 profile banner. Bundled artwork when present; otherwise engraved waves over the ink
 * base with the banner's motif on the right third (the avatar and name sit on the left).
 */
export const ProfileBanner = memo(function ProfileBanner({ id, width }: ProfileBannerProps) {
  const { colors } = useTheme();
  const visual = resolveCosmetic('banner', id);
  const paint = tierPaint(visual.tier, colors);
  const height = Math.round(width / BANNER_RATIO);
  const waves = useMemo(() => wavesPath(width, height, 14, visual.seed), [height, visual.seed, width]);

  return (
    <View style={[styles.frame, { width, height, backgroundColor: colors.surface }]}>
      {visual.image ? (
        <Image source={visual.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
      ) : (
        <>
          <Canvas style={StyleSheet.absoluteFill}>
            <Rect x={0} y={0} width={width} height={height}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(width, height)}
                colors={[colors.surface, colors.surfaceRaised, paint.sweep ? (paint.sweep[1] ?? paint.line) : colors.surfaceRaised]}
                positions={[0, 0.62, 1]}
              />
            </Rect>
            <Path path={waves} style="stroke" strokeWidth={1} color={paint.line} opacity={0.22} />
          </Canvas>
          <View style={styles.motif}>
            <Icon name={visual.icon} size={height * 0.62} color={paint.line} />
          </View>
        </>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  frame: { borderRadius: radius, overflow: 'hidden' },
  motif: { position: 'absolute', right: '8%', top: 0, bottom: 0, justifyContent: 'center', opacity: 0.85 },
});
