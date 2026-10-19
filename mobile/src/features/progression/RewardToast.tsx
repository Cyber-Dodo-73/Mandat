import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, Text } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { radius, shadow, spacing, useTheme } from '@/theme';
import { springs } from '@/theme/motion';

import type { Reward } from './api';
import { RewardChips } from './RewardChips';

const VISIBLE_MS = 1800;

/**
 * Reward banner: drops in from the top, holds, then flies up towards the top bar and fades,
 * as if the reward went into the wallet.
 */
export function RewardToast({ reward, onDone }: { reward: Reward; onDone: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const offset = useSharedValue(reduceMotion ? 0 : -80);
  const opacity = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    if (reduceMotion) {
      const timer = setTimeout(onDone, VISIBLE_MS);
      return () => clearTimeout(timer);
    }
    const leave = { duration: 420, easing: Easing.in(Easing.cubic) };
    offset.set(withSequence(withSpring(0, springs.bounce), withDelay(VISIBLE_MS, withTiming(-120, leave))));
    opacity.set(
      withSequence(
        withTiming(1, { duration: 160 }),
        withDelay(
          VISIBLE_MS,
          withTiming(0, leave, (finished) => {
            if (finished) scheduleOnRN(onDone);
          }),
        ),
      ),
    );
    return undefined;
  }, [offset, onDone, opacity, reduceMotion]);

  const style = useAnimatedStyle(() => ({ opacity: opacity.get(), transform: [{ translateY: offset.get() }] }));

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLiveRegion="polite"
      style={[
        styles.toast,
        shadow,
        { top: insets.top + spacing.xs, backgroundColor: colors.surfaceRaised, borderColor: colors.border, shadowColor: colors.shadow },
        style,
      ]}
    >
      <Icon name="gift" size={22} tone="accent" />
      <Text variant="label" style={styles.title}>
        {t('progression.reward.title')}
      </Text>
      <RewardChips reward={reward} color={colors.surface} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  title: { marginRight: spacing.xxs },
});
