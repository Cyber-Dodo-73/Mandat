import { Canvas, Group, LinearGradient, Path, Skia, vec } from '@shopify/react-native-skia';
import { useEffect } from 'react';
import { useDerivedValue, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { rarityStyles, useTheme } from '@/theme';

// Flame drawn on a 24×24 grid: outer tongue and inner core.
const OUTER = Skia.Path.MakeFromSVGString(
  'M12 1.5C13.6 5.4 18.8 8.3 18.8 14.2C18.8 18.4 15.7 22 12 22C8.3 22 5.2 18.4 5.2 14.6C5.2 11.4 7 9.4 8.6 7.9C8.7 10.1 9.6 11.6 11 12.2C10.6 8.6 11.2 4.6 12 1.5Z',
)!;
const INNER = Skia.Path.MakeFromSVGString(
  'M12.2 11.8C13.9 13.6 15.4 15 15.4 17.4C15.4 19.6 13.9 21 12 21C10.1 21 8.6 19.6 8.6 17.6C8.6 15.9 9.6 14.8 10.6 14.1C10.8 15.3 11.4 16 12.1 16.3C11.8 14.7 11.9 13.1 12.2 11.8Z',
)!;

/** Size grows with the streak, up to a month (a longer streak keeps the biggest flame). */
export function flameSize(streak: number, base = 18): number {
  return base + (Math.min(streak, 30) / 30) * 10;
}

type StreakFlameProps = {
  streak: number;
  /** Lit when today's activity is done; dimmed (still visible) while the streak is at risk. */
  activeToday: boolean;
  base?: number;
};

/** Duolingo-like flame: bigger with the streak length, a soft flicker while lit. */
export function StreakFlame({ streak, activeToday, base = 18 }: StreakFlameProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const size = flameSize(streak, base);
  const flicker = useSharedValue(1);
  const lit = streak > 0 && activeToday;

  useEffect(() => {
    if (!lit || reduceMotion) {
      flicker.set(1);
      return;
    }
    flicker.set(withRepeat(withSequence(withTiming(1.07, { duration: 520 }), withTiming(0.97, { duration: 640 })), -1, true));
  }, [flicker, lit, reduceMotion]);

  const transform = useDerivedValue(() => [{ scaleY: flicker.get() }]);
  const scale = size / 24;
  // The flame borrows the legendary gold for its heart: the only warm tone besides the accent.
  const gold = rarityStyles.legendary.color;
  const outerColors = lit ? [gold, colors.accent] : [colors.textMuted, colors.border];
  const innerColor = lit ? colors.text : colors.surfaceRaised;

  return (
    <Canvas style={{ width: size, height: size }}>
      <Group transform={[{ scale }]}>
        <Group origin={vec(12, 22)} transform={transform}>
          <Path path={OUTER}>
            <LinearGradient start={vec(12, 2)} end={vec(12, 22)} colors={outerColors} />
          </Path>
          <Path path={INNER} color={innerColor} />
        </Group>
      </Group>
    </Canvas>
  );
}
