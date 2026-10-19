import { StyleSheet, View } from 'react-native';

import { Caption, Icon } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

/** Shown where an action needs the server: what still works offline stays usable. */
export function OfflineNotice({ message }: { message?: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View
      accessibilityRole="alert"
      style={[styles.notice, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}
    >
      <Icon name="cloud-offline-outline" size={18} color={colors.textMuted} />
      <Caption style={styles.text}>{message ?? t('offline.banner')}</Caption>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius / 2,
    borderWidth: 1,
  },
  text: { flexShrink: 1 },
});
