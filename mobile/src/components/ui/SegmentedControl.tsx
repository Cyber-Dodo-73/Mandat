import { StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';

import { PressableScale } from './PressableScale';
import { Text } from './Text';

export type SegmentOption<T extends string> = { value: T; label: string };

type SegmentedControlProps<T extends string> = {
  options: readonly SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  accessibilityLabel: string;
};

export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  accessibilityLabel,
}: SegmentedControlProps<T>) {
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="radiogroup"
      accessibilityLabel={accessibilityLabel}
      style={[styles.container, { backgroundColor: colors.surfaceRaised }]}
    >
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <PressableScale
            key={option.value}
            haptic="toggle"
            accessibilityRole="radio"
            accessibilityLabel={option.label}
            accessibilityState={{ selected }}
            onPress={() => onChange(option.value)}
            containerStyle={styles.segmentTarget}
            style={[styles.segment, selected ? { backgroundColor: colors.accent } : null]}
          >
            <Text variant="label" color={selected ? colors.onAccent : colors.textMuted} numberOfLines={1}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', borderRadius: radius, padding: spacing.xxs, gap: spacing.xxs },
  segmentTarget: { flex: 1 },
  segment: {
    minHeight: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius,
    paddingHorizontal: spacing.sm,
  },
});
