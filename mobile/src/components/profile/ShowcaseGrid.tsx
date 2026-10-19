import { memo, useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CARD_RATIO, TradingCard } from '@/components/cards';
import { Icon, Text } from '@/components/ui';
import { getCard } from '@/data/catalog';
import { refKey, SHOWCASE_MAX, slotAt, type CardRef } from '@/features/profile/showcase';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useLanguage, useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';
import { instant, springs, timings } from '@/theme/motion';

const COLUMNS = 3;
const GAP = spacing.sm;
const LONG_PRESS_MS = 220;

type ShowcaseGridProps = {
  items: readonly CardRef[];
  width: number;
  /** Long-press then drag to reorder; empty slots open the picker. */
  editable?: boolean;
  onReorder?: (next: CardRef[]) => void;
  onPressCard?: (ref: CardRef) => void;
  onPressEmpty?: () => void;
};

/**
 * Up to six cards on display, three per row, with their foil. Editable showcases reorder by
 * long-press and drag: the dragged card lifts and the others slide to make room.
 */
export function ShowcaseGrid({ items, width, editable = false, onReorder, onPressCard, onPressEmpty }: ShowcaseGridProps) {
  const cellWidth = Math.floor((width - GAP * (COLUMNS - 1)) / COLUMNS);
  const cellHeight = Math.round(cellWidth * CARD_RATIO);
  const slots = editable ? Math.min(SHOWCASE_MAX, items.length + 1) : items.length;
  const rows = Math.max(1, Math.ceil(slots / COLUMNS));
  const keys = items.map(refKey);
  const order = useSharedValue<string[]>(keys);
  const keysSignature = keys.join('|');

  // Server or picker changes reset the local order.
  useEffect(() => {
    order.set(keysSignature ? keysSignature.split('|') : []);
  }, [keysSignature, order]);

  const layout = { columns: COLUMNS, cellWidth, cellHeight, gap: GAP, count: items.length };

  const commit = (next: string[]) => {
    if (!onReorder) return;
    const byKey = new Map(items.map((item) => [refKey(item), item]));
    onReorder(next.map((key) => byKey.get(key)).filter((item): item is CardRef => Boolean(item)));
  };

  return (
    <View style={{ width, height: rows * cellHeight + (rows - 1) * GAP }}>
      {editable && items.length < SHOWCASE_MAX ? (
        <EmptySlot index={items.length} layout={layout} onPress={onPressEmpty} />
      ) : null}
      {items.map((item) => (
        <ShowcaseItem
          key={refKey(item)}
          item={item}
          order={order}
          layout={layout}
          editable={editable}
          onPress={onPressCard}
          onCommit={commit}
        />
      ))}
    </View>
  );
}

type Layout = { columns: number; cellWidth: number; cellHeight: number; gap: number; count: number };

function slotOrigin(index: number, layout: Layout) {
  'worklet';
  const column = index % layout.columns;
  const row = Math.floor(index / layout.columns);
  return { x: column * (layout.cellWidth + layout.gap), y: row * (layout.cellHeight + layout.gap) };
}

type ShowcaseItemProps = {
  item: CardRef;
  order: SharedValue<string[]>;
  layout: Layout;
  editable: boolean;
  onPress?: (ref: CardRef) => void;
  onCommit: (next: string[]) => void;
};

const ShowcaseItem = memo(function ShowcaseItem({ item, order, layout, editable, onPress, onCommit }: ShowcaseItemProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const reduceMotion = useReduceMotion();
  const key = refKey(item);
  const card = getCard(item.cardId);
  const dragging = useSharedValue(false);
  const dragX = useSharedValue(0);
  const dragY = useSharedValue(0);
  const index = useDerivedValue(() => Math.max(0, order.get().indexOf(key)));
  const startIndex = useSharedValue(0);

  const pan = usePanGesture({
    enabled: editable,
    activateAfterLongPress: LONG_PRESS_MS,
    onActivate: () => {
      startIndex.set(index.get());
      dragging.set(true);
      scheduleOnRN(haptics.toggle);
    },
    onUpdate: (event) => {
      dragX.set(event.translationX);
      dragY.set(event.translationY);
      const origin = slotOrigin(startIndex.get(), layout);
      const target = slotAt(
        origin.x + event.translationX + layout.cellWidth / 2,
        origin.y + event.translationY + layout.cellHeight / 2,
        layout,
      );
      const current = order.get();
      const from = current.indexOf(key);
      if (target !== from && from >= 0) {
        const next = [...current];
        next.splice(from, 1);
        next.splice(target, 0, key);
        order.set(next);
        scheduleOnRN(haptics.tearTick);
      }
    },
    onDeactivate: () => {
      scheduleOnRN(onCommit, order.get());
    },
    onFinalize: () => {
      dragging.set(false);
      dragX.set(0);
      dragY.set(0);
    },
  });

  const style = useAnimatedStyle(() => {
    const isDragging = dragging.get();
    const origin = slotOrigin(isDragging ? startIndex.get() : index.get(), layout);
    const settle = reduceMotion ? withTiming(0, instant) : null;
    const x = isDragging ? origin.x + dragX.get() : origin.x;
    const y = isDragging ? origin.y + dragY.get() : origin.y;
    return {
      zIndex: isDragging ? 10 : 1,
      transform: [
        { translateX: isDragging ? x : reduceMotion ? x : withSpring(x, springs.press) },
        { translateY: isDragging ? y : reduceMotion ? y : withSpring(y, springs.press) },
        { scale: withTiming(isDragging ? 1.08 : 1, settle ? instant : timings.fast) },
      ],
    };
  });

  if (!card) return null;
  return (
    <GestureDetector gesture={pan}>
      <Animated.View style={[styles.item, { width: layout.cellWidth, height: layout.cellHeight }, style]}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('profile.showcase.cardLabel', { name: card.name[language] })}
          accessibilityHint={editable ? t('profile.showcase.reorderHint') : undefined}
          onPress={() => onPress?.(item)}
        >
          <TradingCard card={card} finish={item.finish} size="grid" width={layout.cellWidth} interactive={false} gyro={false} />
        </Pressable>
      </Animated.View>
    </GestureDetector>
  );
});

function EmptySlot({ index, layout, onPress }: { index: number; layout: Layout; onPress?: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const origin = slotOrigin(index, layout);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={t('profile.showcase.add')}
      onPress={() => {
        haptics.tap();
        onPress?.();
      }}
      style={[
        styles.empty,
        {
          width: layout.cellWidth,
          height: layout.cellHeight,
          left: origin.x,
          top: origin.y,
          borderColor: colors.border,
        },
      ]}
    >
      <Icon name="add" size={28} tone="textMuted" />
      <Text variant="caption" tone="muted" align="center">
        {t('profile.showcase.add')}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  item: { position: 'absolute', left: 0, top: 0 },
  empty: {
    position: 'absolute',
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: radius / 2,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxs,
  },
});
