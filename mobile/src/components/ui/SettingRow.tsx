import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Icon, type IconName } from './Icon';
import { Caption, Text } from './Text';

type SettingRowProps = {
  icon: IconName;
  label: string;
  hint?: string;
  /** Control rendered on the right (toggle, chevron...). */
  control?: ReactNode;
};

export function SettingRow({ icon, label, hint, control }: SettingRowProps) {
  return (
    <View style={styles.row}>
      <Icon name={icon} tone="textMuted" />
      <View style={styles.texts}>
        <Text variant="bodyStrong">{label}</Text>
        {hint ? <Caption>{hint}</Caption> : null}
      </View>
      {control}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 48 },
  texts: { flex: 1, gap: 2 },
});
