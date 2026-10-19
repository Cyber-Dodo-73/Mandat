import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { buttonDepth, radius, spacing, useTheme, type ThemeColors } from '@/theme';
import { instant, springs } from '@/theme/motion';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

export type Button3DVariant = 'primary' | 'brand' | 'success' | 'secondary' | 'danger' | 'ghost' | 'apple';
export type Button3DSize = 'sm' | 'md' | 'lg';

type Palette = { face: string; edge: string; label: string; border?: string };

const HEIGHT: Record<Button3DSize, number> = { sm: 44, md: 54, lg: 62 };
const PADDING: Record<Button3DSize, number> = { sm: spacing.md, md: spacing.lg, lg: spacing.xl };

function paletteFor(variant: Button3DVariant, colors: ThemeColors): Palette {
  switch (variant) {
    case 'primary':
      return { face: colors.accent, edge: colors.accentEdge, label: colors.onAccent };
    case 'brand':
      return { face: colors.brand, edge: colors.brandEdge, label: colors.onBrand };
    case 'success':
      return { face: colors.success, edge: colors.successEdge, label: colors.onAccent };
    case 'secondary':
      return { face: colors.neutralButton, edge: colors.neutralButtonEdge, label: colors.text };
    case 'danger':
      return { face: colors.danger, edge: colors.dangerEdge, label: colors.onDanger };
    case 'ghost':
      return { face: 'transparent', edge: 'transparent', label: colors.accent };
    case 'apple':
      return { face: colors.appleButton, edge: colors.appleButtonEdge, label: colors.onAppleButton };
  }
}

export type Button3DProps = {
  label: string;
  onPress: () => void;
  variant?: Button3DVariant;
  size?: Button3DSize;
  icon?: IconName;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

/**
 * Duolingo-style button: the face sits on a thick colored edge and sinks into
 * it while pressed, so the edge disappears.
 */
export function Button3D({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityHint,
  testID,
}: Button3DProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  // Disabled buttons switch to a quiet, legible neutral face instead of a faded accent.
  const palette: Palette =
    disabled && variant !== 'ghost'
      ? { face: colors.surfaceRaised, edge: colors.neutralButtonEdge, label: colors.textMuted, border: colors.hairline }
      : paletteFor(variant, colors);
  const depth = variant === 'ghost' ? 0 : buttonDepth;
  const height = HEIGHT[size];
  const inactive = disabled || loading;

  const pressDepth = useSharedValue(0);
  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressDepth.get() }] }));

  const sinkTo = (value: number) => {
    pressDepth.set(reduceMotion ? withTiming(value, instant) : withSpring(value, springs.press));
  };

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPressIn={() => {
        sinkTo(depth);
        haptics.tap();
      }}
      onPressOut={() => sinkTo(0)}
      onPress={() => {
        playSound('tap');
        onPress();
      }}
      style={[{ height: height + depth, opacity: disabled && variant === 'ghost' ? 0.45 : 1 }, fullWidth ? styles.fullWidth : styles.hug]}
    >
      <View style={[styles.edge, { top: depth, height, backgroundColor: palette.edge }]} />
      <Animated.View
        style={[
          styles.face,
          {
            height,
            paddingHorizontal: PADDING[size],
            backgroundColor: palette.face,
            borderColor: palette.border ?? palette.face,
          },
          faceStyle,
        ]}
      >
        {/* Glossy top light, like a candy-shell game button. */}
        {variant !== 'ghost' && !disabled ? <View pointerEvents="none" style={[styles.gloss, { height: height * 0.34 }]} /> : null}
        {loading ? (
          <ActivityIndicator color={palette.label} />
        ) : (
          <>
            {icon ? <Icon name={icon} size={size === 'sm' ? 18 : 22} color={palette.label} /> : null}
            <Text
              variant="label"
              color={palette.label}
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.75}
              style={styles.label}
            >
              {label}
            </Text>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  fullWidth: { alignSelf: 'stretch' },
  hug: { alignSelf: 'flex-start' },
  edge: {
    position: 'absolute',
    left: 0,
    right: 0,
    borderRadius: radius,
  },
  face: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth * 2,
    overflow: 'hidden',
  },
  gloss: {
    position: 'absolute',
    top: 3,
    left: 10,
    right: 10,
    borderRadius: radius,
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
  },
  label: { flexShrink: 1, textTransform: 'uppercase', fontFamily: 'Nunito_900Black', letterSpacing: 0.6 },
});
