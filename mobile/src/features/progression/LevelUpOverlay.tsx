import { Canvas, Group, Path, Skia, vec } from '@shopify/react-native-skia';
import { useEffect, useMemo } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
  Easing,
} from 'react-native-reanimated';

import { Body, Button3D, GameBackground, Text, Title } from '@/components/ui';
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

const BADGE = 132;
const RAYS_SIZE = BADGE * 2.6;

/**
 * Full-screen level-up moment, in a native modal so it sits above everything (tab bar included)
 * on an opaque ground: rays behind the number only, the rewards, one button.
 */
export function LevelUpOverlay({ level, rewards, onDone }: LevelUpOverlayProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const insets = useSafeAreaInsets();
  const rays = useMemo(() => raysPath(RAYS_SIZE / 2), []);
  const spin = useSharedValue(0);
  const pop = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    haptics.levelUp();
    playSound('level_up');
    if (reduceMotion) return;
    spin.set(withRepeat(withTiming(Math.PI * 2, { duration: 24000, easing: Easing.linear }), -1, false));
    pop.set(withDelay(120, withSpring(1, springs.bounce)));
  }, [pop, reduceMotion, spin]);

  const raysTransform = useDerivedValue(() => [{ rotate: spin.get() }]);
  // Opacity + a small rise: no scale-up from tiny (keeps the text crisp from the first frame).
  const badgeStyle = useAnimatedStyle(() => ({ opacity: pop.get(), transform: [{ translateY: (1 - pop.get()) * 24 }] }));

  return (
    <Modal visible transparent animationType={reduceMotion ? 'none' : 'fade'} statusBarTranslucent onRequestClose={onDone}>
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]} accessibilityViewIsModal>
        <GameBackground />
        <View style={styles.center}>
          <View style={styles.hero}>
            <Canvas style={styles.rays} pointerEvents="none">
              <Group transform={[{ translateX: RAYS_SIZE / 2 }, { translateY: RAYS_SIZE / 2 }]}>
                <Group origin={vec(0, 0)} transform={raysTransform}>
                  <Path path={rays} color={colors.gold} opacity={0.28} />
                </Group>
              </Group>
            </Canvas>
            <Animated.View style={[styles.badge, { backgroundColor: colors.brand, borderColor: colors.brandEdge }, badgeStyle]}>
              <Text variant="display" color={colors.onBrand} allowFontScaling={false} style={styles.level}>
                {level}
              </Text>
            </Animated.View>
          </View>
          <Title align="center">{t('progression.levelUp.title', { level })}</Title>
          {rewards ? (
            <View style={styles.rewards}>
              <Body tone="muted" align="center">
                {t('progression.levelUp.rewards')}
              </Body>
              <RewardChips reward={rewards} />
            </View>
          ) : null}
        </View>
        <Button3D label={t('progression.levelUp.continue')} onPress={onDone} fullWidth size="lg" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: spacing.lg, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  hero: { width: RAYS_SIZE, height: RAYS_SIZE, alignItems: 'center', justifyContent: 'center', marginVertical: -spacing.xl },
  rays: { position: 'absolute', width: RAYS_SIZE, height: RAYS_SIZE },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    borderBottomWidth: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  level: { fontSize: 60, lineHeight: 66 },
  rewards: { alignItems: 'center', gap: spacing.xs },
});
