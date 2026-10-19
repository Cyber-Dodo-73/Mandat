import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Body } from './Text';

type EmptyStateProps = { icon: IconName; message: string };

export function EmptyState({ icon, message }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Icon name={icon} size={32} tone="textMuted" />
      <Body tone="muted" align="center">
        {message}
      </Body>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.lg, paddingHorizontal: spacing.md },
});
