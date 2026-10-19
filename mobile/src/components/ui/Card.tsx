import type { ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native';

import { radius, shadow, spacing, useTheme } from '@/theme';

type CardProps = ViewProps & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Raised cards get the single app shadow; flat ones only a border. */
  raised?: boolean;
};

export function Card({ children, style, raised = false, ...rest }: CardProps) {
  const { colors } = useTheme();
  return (
    <View
      {...rest}
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        raised ? [shadow, { shadowColor: colors.shadow }] : null,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius,
    borderWidth: 0,
    borderBottomWidth: 4,
    padding: spacing.md,
    gap: spacing.sm,
  },
});
