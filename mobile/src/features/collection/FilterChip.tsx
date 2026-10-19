import { StyleSheet, View } from 'react-native';

import { PressableScale, Text } from '@/components/ui';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';

type FilterChipProps = {
  label: string;
  selected: boolean;
  onToggle: () => void;
  /** Dot shown before the label (rarity color). */
  dotColor?: string;
};

/** Toggleable chip of the filter sheet: filled with the accent when active. */
export function FilterChip({ label, selected, onToggle, dotColor }: FilterChipProps) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      onPress={() => {
        haptics.toggle();
        onToggle();
      }}
      style={[
        styles.chip,
        selected
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
      ]}
    >
      {dotColor ? <View style={[styles.dot, { backgroundColor: dotColor }]} /> : null}
      <Text variant="label" color={selected ? colors.onAccent : colors.text} numberOfLines={1}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius,
    borderWidth: 1,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
