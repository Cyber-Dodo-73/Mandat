import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { Body, Button3D, Heading, PressableScale, Text } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

import type { FtueRect } from './anchors';

export type CoachAction = { label: string; onPress: () => void };

type CoachBubbleProps = {
  title: string;
  body: string;
  step: { current: number; total: number };
  /** Target the bubble points at; null centers it near the bottom. */
  target: FtueRect | null;
  layer: { width: number; height: number };
  primary?: CoachAction;
  onSkipStep: () => void;
  onQuit: () => void;
  /** Keep the bubble at the top (pack opening: the stack fills the middle). */
  placement?: 'auto' | 'top' | 'bottom';
};

const ARROW = 12;
const GAP = 14;

/**
 * The tour's speech bubble: chunky card with the step counter, a big title, one sentence,
 * and always a way out ("Passer" for this step, "Quitter" for the whole tour).
 */
export function CoachBubble({ title, body, step, target, layer, primary, onSkipStep, onQuit, placement = 'auto' }: CoachBubbleProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();

  const below = placement === 'top' ? false : placement === 'bottom' ? true : target ? target.y + target.height / 2 < layer.height / 2 : true;
  const position =
    placement === 'top'
      ? { top: spacing.xxl * 2 }
      : target
        ? below
          ? { top: Math.min(target.y + target.height + GAP + ARROW, layer.height - 240) }
          : { bottom: Math.max(layer.height - target.y + GAP + ARROW, spacing.lg) }
        : { bottom: spacing.xxl * 2 };
  const arrowLeft = target ? Math.min(Math.max(target.x + target.width / 2 - spacing.md - ARROW, spacing.lg), layer.width - spacing.md * 2 - ARROW * 3) : null;
  const entering = reduceMotion ? undefined : below ? FadeInUp.springify().damping(14) : FadeInDown.springify().damping(14);

  return (
    <Animated.View
      entering={entering}
      style={[styles.wrap, position]}
      pointerEvents="box-none"
      accessibilityViewIsModal={false}
      accessibilityLiveRegion="polite"
    >
      {target && below && arrowLeft !== null ? (
        <View style={[styles.arrowUp, { left: arrowLeft, borderBottomColor: colors.accent }]} />
      ) : null}
      <View
        style={[styles.bubble, { backgroundColor: colors.surfaceRaised, borderColor: colors.accent, borderBottomColor: colors.accentEdge }]}
        accessible={false}
      >
        <View style={styles.header}>
          <View style={[styles.pill, { backgroundColor: colors.accent }]}>
            <Text variant="caption" tone="onAccent" style={styles.pillText}>
              {t('ftue.common.stepOf', step)}
            </Text>
          </View>
          <PressableScale accessibilityRole="button" accessibilityLabel={t('ftue.common.quit')} hitSlop={12} onPress={onQuit}>
            <Text variant="caption" tone="muted">
              {t('ftue.common.quit')}
            </Text>
          </PressableScale>
        </View>
        <Heading accessibilityRole="header">{title}</Heading>
        <Body>{body}</Body>
        <View style={styles.actions}>
          <View style={styles.skip}>
            <Button3D label={t('ftue.common.skip')} variant="ghost" size="sm" onPress={onSkipStep} />
          </View>
          {primary ? (
            <View style={styles.primary}>
              <Button3D label={primary.label} size="sm" fullWidth onPress={primary.onPress} />
            </View>
          ) : null}
        </View>
      </View>
      {target && !below && arrowLeft !== null ? (
        <View style={[styles.arrowDown, { left: arrowLeft, borderTopColor: colors.accentEdge }]} />
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: spacing.md, right: spacing.md },
  bubble: {
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius,
    borderWidth: 2,
    borderBottomWidth: 6,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  pill: { paddingHorizontal: spacing.sm, paddingVertical: 2, borderRadius: 999 },
  pillText: { fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase' },
  actions: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.xxs },
  skip: { flexShrink: 0 },
  primary: { flex: 1 },
  arrowUp: {
    width: 0,
    height: 0,
    marginBottom: -2,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderBottomWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
  arrowDown: {
    width: 0,
    height: 0,
    marginTop: -2,
    borderLeftWidth: ARROW,
    borderRightWidth: ARROW,
    borderTopWidth: ARROW,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
