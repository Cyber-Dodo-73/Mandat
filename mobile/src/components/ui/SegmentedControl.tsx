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
            style={[styles.segment, selected ? { backgroundColor: colors.brand, borderBottomColor: colors.brandEdge } : null]}
          >
            <Text variant="label" color={selected ? colors.onBrand : colors.textMuted} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // Full width even inside sheets or centered parents: segments share it equally.
  container: { flexDirection: 'row', alignSelf: 'stretch', width: '100%', borderRadius: radius, padding: spacing.xxs, gap: spacing.xxs },
  segmentTarget: { flexGrow: 1, flexBasis: 0, minWidth: 0 },
  segment: {
    minHeight: 44,
    borderBottomWidth: 4,
    borderBottomColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius,
    paddingHorizontal: spacing.sm,
  },
});
