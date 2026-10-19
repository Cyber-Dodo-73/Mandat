import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useTheme, type ThemeColors } from '@/theme';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type IconProps = {
  name: IconName;
  size?: number;
  color?: string;
  tone?: keyof ThemeColors;
};

/** Decorative by default: the surrounding control carries the accessible label. */
export function Icon({ name, size = 22, color, tone = 'text' }: IconProps) {
  const { colors } = useTheme();
  return (
    <Ionicons
      name={name}
      size={size}
      color={color ?? colors[tone]}
      accessibilityElementsHidden
      importantForAccessibility="no"
    />
  );
}
