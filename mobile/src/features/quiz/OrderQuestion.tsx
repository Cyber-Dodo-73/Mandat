import { StyleSheet, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, type SharedValue } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { Icon, Text } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';
import { springs } from '@/theme/motion';

import type { QuizOption } from './api';
import { OptionFigure } from './OptionFigure';
import { dropIndex, moveItem } from './reorder';

const ROW_HEIGHT = 64;
const ROW_GAP = spacing.xs;
const STEP = ROW_HEIGHT + ROW_GAP;

type RowState = 'idle' | 'correct' | 'wrong';

type OrderQuestionProps = {
  options: readonly QuizOption[];
  /** Current order, as option ids. */
  order: readonly string[];
  onChange: (order: string[]) => void;
  /** Once answered the list is frozen and each row shows whether it is in place. */
  locked: boolean;
  correctOrder?: readonly string[];
};

/** "Put these figures in chronological order": drag a row (or use the VoiceOver actions). */
export function OrderQuestion({ options, order, onChange, locked, correctOrder }: OrderQuestionProps) {
  const active = useSharedValue(-1);
  const hover = useSharedValue(-1);
  const dragY = useSharedValue(0);
  const byId = new Map(options.map((option) => [option.id, option]));

  const drop = (from: number, to: number) => {
    if (from !== to) {
      haptics.toggle();
      onChange(moveItem(order, from, to));
    }
  };

  return (
    <View style={{ height: order.length * STEP - ROW_GAP }}>
      {order.map((id, index) => {
        const option = byId.get(id);
        if (!option) return null;
        const state: RowState = !locked || !correctOrder ? 'idle' : correctOrder[index] === id ? 'correct' : 'wrong';
        return (
          <OrderRow
            key={id}
            option={option}
            index={index}
            count={order.length}
            state={state}
            locked={locked}
            active={active}
            hover={hover}
            dragY={dragY}
            onDrop={drop}
          />
        );
      })}
    </View>
  );
}

type OrderRowProps = {
  option: QuizOption;
  index: number;
  count: number;
  state: RowState;
  locked: boolean;
  active: SharedValue<number>;
  hover: SharedValue<number>;
  dragY: SharedValue<number>;
  onDrop: (from: number, to: number) => void;
};

function OrderRow({ option, index, count, state, locked, active, hover, dragY, onDrop }: OrderRowProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();

  const pan = Gesture.Pan()
    .enabled(!locked)
    .activateAfterLongPress(120)
    .onStart(() => {
      active.set(index);
      hover.set(index);
      scheduleOnRN(haptics.tap);
    })
    .onUpdate((event) => {
      dragY.set(event.translationY);
      const target = Math.max(0, Math.min(count - 1, index + Math.round(event.translationY / STEP)));
      hover.set(target);
    })
    .onEnd((event) => {
      scheduleOnRN(onDrop, index, dropIndex(index, event.translationY, STEP, count));
    })
    .onFinalize(() => {
      active.set(-1);
      hover.set(-1);
      dragY.set(0);
    });

  const style = useAnimatedStyle(() => {
    const dragged = active.get();
    const target = hover.get();
    let offset = 0;
    if (dragged === index) offset = dragY.get();
    else if (dragged >= 0 && index > dragged && index <= target) offset = -STEP;
    else if (dragged >= 0 && index < dragged && index >= target) offset = STEP;
    const y = index * STEP + offset;
    return {
      transform: [
        { translateY: dragged === index || reduceMotion ? y : withSpring(y, springs.press) },
        { scale: dragged === index ? 1.03 : 1 },
      ],
      zIndex: dragged === index ? 2 : 1,
    };
  });

  const borderColor = state === 'correct' ? colors.success : state === 'wrong' ? colors.danger : colors.border;

  return (
    <GestureDetector gesture={pan}>
      <Animated.View
        accessible
        accessibilityRole="adjustable"
        accessibilityLabel={t('quiz.order.rowA11y', { position: index + 1, label: option.label })}
        accessibilityActions={[
          { name: 'increment', label: t('quiz.order.moveUp') },
          { name: 'decrement', label: t('quiz.order.moveDown') },
        ]}
        onAccessibilityAction={(event) => {
          if (locked) return;
          if (event.nativeEvent.actionName === 'increment') onDrop(index, index - 1);
          if (event.nativeEvent.actionName === 'decrement') onDrop(index, index + 1);
        }}
        style={[styles.row, { backgroundColor: colors.surfaceRaised, borderColor }, style]}
      >
        <Text variant="label" tone="muted" style={styles.rank}>
          {index + 1}
        </Text>
        <OptionFigure option={option} />
        <Text variant="bodyStrong" numberOfLines={2} style={styles.label}>
          {option.label}
        </Text>
        {locked ? (
          <Icon name={state === 'correct' ? 'checkmark-circle' : 'close-circle'} size={22} tone={state === 'correct' ? 'success' : 'danger'} />
        ) : (
          <Icon name="reorder-three" size={24} tone="textMuted" />
        )}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  row: {
    position: 'absolute',
    left: 0,
    right: 0,
    height: ROW_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius,
    borderWidth: 2,
  },
  rank: { width: 16, textAlign: 'center' },
  label: { flex: 1 },
});
