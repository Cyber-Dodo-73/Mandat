import { Canvas, Circle, Group, Path, SweepGradient, vec } from '@shopify/react-native-skia';
import { Image } from 'expo-image';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon } from '@/components/ui';
import { resolveCosmetic, type CosmeticKind } from '@/features/profile/cosmetics';
import { useTheme } from '@/theme';

import { METAL_COLORS } from '@/features/profile/badges';

import { rosettePath } from './guilloche';
import { tierPaint } from './tierColors';

const METAL_SILVER = METAL_COLORS.silver;

type CosmeticEmblemProps = {
  kind: Extract<CosmeticKind, 'avatar' | 'badge'>;
  id: string;
  size: number;
  /** Locked badges and avatars are shown greyed. */
  locked?: boolean;
  /** Medal tint for badges (bronze/silver/gold tiers of an achievement). */
  tint?: string;
};

/**
 * Round avatar or achievement medal: the bundled artwork when it exists, otherwise an engraved
 * seal drawn from the id (guilloché rosette, tier metal, glyph), so the UI never looks empty.
 */
export const CosmeticEmblem = memo(function CosmeticEmblem({ kind, id, size, locked = false, tint }: CosmeticEmblemProps) {
  const { colors } = useTheme();
  const visual = resolveCosmetic(kind, id);
  const paint = tierPaint(visual.tier, colors);
  const line = locked ? colors.border : (tint ?? paint.line);
  const center = size / 2;
  const rosette = useMemo(
    () => rosettePath(center, center, size * 0.36, 9 + Math.round(visual.seed * 6), 4, visual.seed),
    [center, size, visual.seed],
  );

  if (visual.image) {
    // Badge art is cast in neutral silver: bronze and gold tiers are a color blend on top,
    // which keeps the engraving's light and shade.
    const tinted = kind === 'badge' && tint && !locked && tint !== METAL_SILVER;
    return (
      <View
        style={[styles.round, { width: size, height: size, borderRadius: size / 2 }, locked && styles.locked]}
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Image source={visual.image} style={StyleSheet.absoluteFill} contentFit="cover" transition={120} />
        {tinted ? (
          <View
            pointerEvents="none"
            style={[StyleSheet.absoluteFill, { backgroundColor: tint, borderRadius: size / 2, mixBlendMode: 'color', opacity: 0.85 }]}
          />
        ) : null}
      </View>
    );
  }

  const ring = Math.max(2, size * 0.06);
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      <Canvas style={StyleSheet.absoluteFill}>
        <Circle cx={center} cy={center} r={center} color={locked ? colors.surface : paint.fill} />
        <Circle cx={center} cy={center} r={center - ring / 2} style="stroke" strokeWidth={ring} color={line}>
          {!locked && !tint && paint.sweep ? (
            <SweepGradient c={vec(center, center)} colors={[...paint.sweep, paint.sweep[0] ?? line]} />
          ) : null}
        </Circle>
        <Group opacity={locked ? 0.25 : 0.55}>
          <Path path={rosette} style="stroke" strokeWidth={Math.max(0.6, size / 160)} color={line} />
        </Group>
      </Canvas>
      <View style={[StyleSheet.absoluteFill, styles.glyph]}>
        <Icon name={visual.icon} size={size * 0.38} color={locked ? colors.textMuted : (tint ?? paint.glyph)} />
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  round: { overflow: 'hidden' },
  locked: { opacity: 0.35 },
  glyph: { alignItems: 'center', justifyContent: 'center' },
});
