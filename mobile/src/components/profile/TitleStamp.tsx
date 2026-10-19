import { StyleSheet, View } from 'react-native';

import { Icon, Text } from '@/components/ui';
import { useTitleLabel } from '@/features/profile/titles';
import { spacing, useTheme } from '@/theme';

/** The title a player earned, printed like an official stamp under the nickname. */
export function TitleStamp({ titleId }: { titleId: string | null | undefined }) {
  const { colors } = useTheme();
  const label = useTitleLabel(titleId);
  if (!label) return null;
  return (
    <View style={[styles.stamp, { borderColor: colors.accent }]}>
      <Icon name="ribbon" size={14} tone="accent" />
      <Text variant="caption" tone="accent" numberOfLines={1} style={styles.text}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stamp: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xxs,
    borderWidth: 1.5,
    borderRadius: 6,
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    transform: [{ rotate: '-2deg' }],
  },
  text: { fontWeight: '700' },
});
