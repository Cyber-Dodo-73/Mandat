import { StyleSheet, View } from 'react-native';

import { fontFamilies, radius, spacing, useTheme } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Text } from './Text';

type BadgeProps = {
  label: string;
  /** Background color; defaults to the raised surface. */
  color?: string;
  /** Label color; defaults to the theme text color. */
  textColor?: string;
  icon?: IconName;
};

export function Badge({ label, color, textColor, icon }: BadgeProps) {
  const { colors } = useTheme();
  const foreground = textColor ?? colors.text;
  return (
    <View style={[styles.badge, { backgroundColor: color ?? colors.surfaceRaised }]}>
      {icon ? <Icon name={icon} size={14} color={foreground} /> : null}
      <Text variant="caption" color={foreground} style={styles.label} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    paddingHorizontal: spacing.xs + 2,
    paddingVertical: spacing.xxs,
    borderRadius: radius,
  },
  label: { fontFamily: fontFamilies.bodyBold, textTransform: 'uppercase', letterSpacing: 0.6 },
});
