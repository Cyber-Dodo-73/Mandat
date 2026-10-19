import { useEffect, useState, type ReactNode } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
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
  /** Pinned under the scrolling content (e.g. the sheet's main button), above the home indicator. */
  footer?: ReactNode;
  /** Set to false when the content brings its own virtualized list. */
  scroll?: boolean;
};

/** Bottom sheet that slides up and can be dragged down to dismiss. */
export function Sheet({ visible, onClose, title, children, footer, scroll = true }: SheetProps) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const { height: screenHeight } = useWindowDimensions();
  // Never taller than the screen: the handle and title stay below the status bar / Dynamic Island.
  const maxHeight = screenHeight - insets.top - spacing.md;
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
        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            { backgroundColor: colors.surface, maxHeight, paddingBottom: insets.bottom + spacing.md },
            sheetStyle,
          ]}
        >
          {/* Drag the header to dismiss; the body scrolls on its own. */}
          <GestureDetector gesture={pan}>
            <View style={styles.header}>
              <View style={[styles.handle, { backgroundColor: colors.border }]} />
              {title ? <Heading>{title}</Heading> : null}
            </View>
          </GestureDetector>
          {scroll ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
            >
              {children}
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.bodyContent]}>{children}</View>
          )}
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </Animated.View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius + 8,
    borderTopRightRadius: radius + 8,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  header: { gap: spacing.sm, paddingBottom: spacing.md },
  handle: { alignSelf: 'center', width: 48, height: 6, borderRadius: radius },
  body: { flexGrow: 0, flexShrink: 1 },
  bodyContent: { gap: spacing.md, paddingBottom: spacing.xs },
  footer: { paddingTop: spacing.md, gap: spacing.sm },
});
