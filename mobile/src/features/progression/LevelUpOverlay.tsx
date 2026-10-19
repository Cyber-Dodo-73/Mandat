import { Canvas, Group, Path, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Body, Button3D, Text, Title } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { spacing, useTheme } from '@/theme';
import { springs } from '@/theme/motion';

import type { Reward } from './api';
import { RewardChips } from './RewardChips';

const RAYS = 14;

function raysPath(radius: number) {
  const path = Skia.PathBuilder.Make();
  const half = Math.PI / RAYS / 2.6;
  for (let index = 0; index < RAYS; index += 1) {
    const angle = (index / RAYS) * Math.PI * 2;
    path.moveTo(0, 0);
    path.lineTo(Math.cos(angle - half) * radius, Math.sin(angle - half) * radius);
    path.lineTo(Math.cos(angle + half) * radius, Math.sin(angle + half) * radius);
    path.close();
  }
  return path.detach();
}

type LevelUpOverlayProps = { level: number; rewards: Reward | null; onDone: () => void };

/** Full-screen level-up moment: rays, the new level popping in, the rewards it brought. */
export function LevelUpOverlay({ level, rewards, onDone }: LevelUpOverlayProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const { width, height } = useWindowDimensions();
  const rays = useMemo(() => raysPath(Math.max(width, height)), [width, height]);
  const spin = useSharedValue(0);
  const pop = useSharedValue(reduceMotion ? 1 : 0.4);

  useEffect(() => {
    haptics.levelUp();
    playSound('level_up');
    if (reduceMotion) return;
    spin.set(withRepeat(withTiming(Math.PI * 2, { duration: 24000, easing: Easing.linear }), -1, false));
    pop.set(withDelay(120, withSpring(1, springs.bounce)));
  }, [pop, reduceMotion, spin]);

  const raysTransform = useDerivedValue(() => [{ rotate: spin.get() }]);
  const badgeStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));

  return (
    <Animated.View
      entering={FadeIn.duration(reduceMotion ? 0 : 220)}
      exiting={FadeOut.duration(reduceMotion ? 0 : 200)}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]}
      accessibilityViewIsModal
    >
      <Pressable style={StyleSheet.absoluteFill} onPress={onDone} accessibilityRole="button" accessibilityLabel={t('progression.levelUp.continue')}>
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Group transform={[{ translateX: width / 2 }, { translateY: height * 0.4 }]}>
            <Group origin={vec(0, 0)} transform={raysTransform}>
              <Path path={rays} color={colors.accent} opacity={0.18} />
            </Group>
          </Group>
        </Canvas>
      </Pressable>

      <View style={styles.content} pointerEvents="box-none">
        <Text variant="label" tone="accent" style={styles.kicker}>
          {t('progression.levelUp.kicker')}
        </Text>
        <Animated.View style={[styles.badge, { backgroundColor: colors.accent, borderColor: colors.accentEdge }, badgeStyle]}>
          <Text variant="display" color={colors.onAccent} allowFontScaling={false} style={styles.level}>
            {level}
          </Text>
        </Animated.View>
        <Title align="center">{t('progression.levelUp.title', { level })}</Title>
        {rewards ? (
          <View style={styles.rewards}>
            <Body tone="muted" align="center">
              {t('progression.levelUp.rewards')}
            </Body>
            <RewardChips reward={rewards} />
          </View>
        ) : null}
        <Button3D label={t('progression.levelUp.continue')} onPress={onDone} fullWidth />
      </View>
    </Animated.View>
  );
}

const BADGE = 132;

const styles = StyleSheet.create({
  content: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    top: '24%',
    alignItems: 'center',
    gap: spacing.md,
  },
  kicker: { textTransform: 'uppercase', letterSpacing: 2 },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  level: { fontSize: 56, lineHeight: 62 },
  rewards: { alignItems: 'center', gap: spacing.xs },
});
