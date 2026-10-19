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

/** Toggleable chunky chip of the filter sheet: filled with the brand blue when active. */
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
          ? { backgroundColor: colors.brand, borderBottomColor: colors.brandEdge }
          : { backgroundColor: colors.surfaceRaised, borderBottomColor: colors.neutralButtonEdge },
      ]}
    >
      {dotColor ? <View style={[styles.gem, { backgroundColor: dotColor }]} /> : null}
      <Text variant="label" color={selected ? colors.onBrand : colors.text} numberOfLines={1}>
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
    minHeight: 44,
    paddingHorizontal: spacing.md,
    borderRadius: radius,
    borderBottomWidth: 4,
  },
  gem: { width: 10, height: 10, borderRadius: 2, transform: [{ rotate: '45deg' }] },
});
