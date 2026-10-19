import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, GestureHandlerRootView, usePanGesture } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { scheduleOnRN } from 'react-native-worklets';

import { useTranslation } from '@/i18n';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { radius, spacing, useTheme } from '@/theme';
import { instant, springs, timings } from '@/theme/motion';

import { Heading } from './Text';

const HIDDEN_OFFSET = 800;
const DISMISS_DISTANCE = 120;
const DISMISS_VELOCITY = 900;

type SheetProps = {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
};

/** Bottom sheet that slides up and can be dragged down to dismiss. */
export function Sheet({ visible, onClose, title, children }: SheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const [mounted, setMounted] = useState(visible);
  const translateY = useSharedValue(HIDDEN_OFFSET);

  if (visible && !mounted) setMounted(true);

  useEffect(() => {
    if (!mounted) return;
    if (visible) {
      translateY.set(reduceMotion ? withTiming(0, instant) : withSpring(0, springs.gentle));
    } else {
      translateY.set(
        withTiming(HIDDEN_OFFSET, reduceMotion ? instant : timings.base, (finished) => {
          if (finished) scheduleOnRN(setMounted, false);
        }),
      );
    }
  }, [mounted, reduceMotion, translateY, visible]);

  const pan = usePanGesture({
    activeOffsetY: 8,
    onUpdate: (event) => {
      translateY.set(Math.max(0, event.translationY));
    },
    onDeactivate: (event) => {
      if (event.translationY > DISMISS_DISTANCE || event.velocityY > DISMISS_VELOCITY) {
        scheduleOnRN(onClose);
      } else {
        translateY.set(withSpring(0, springs.gentle));
      }
    },
  });

  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: translateY.get() }] }));
  const backdropStyle = useAnimatedStyle(() => ({
    opacity: 1 - Math.min(1, translateY.get() / HIDDEN_OFFSET),
  }));

  return (
    <Modal transparent visible={mounted} animationType="none" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdropStyle]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
          />
        </Animated.View>
        <GestureDetector gesture={pan}>
          <Animated.View
            accessibilityViewIsModal
            style={[
              styles.sheet,
              { backgroundColor: colors.surface, paddingBottom: insets.bottom + spacing.lg },
              sheetStyle,
            ]}
          >
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            {title ? <Heading>{title}</Heading> : null}
            {children}
          </Animated.View>
        </GestureDetector>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius,
    borderTopRightRadius: radius,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: { alignSelf: 'center', width: 44, height: 5, borderRadius: radius },
});
