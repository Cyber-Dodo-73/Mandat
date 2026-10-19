import { StyleSheet, View } from 'react-native';

import { spacing } from '@/theme';

import { Caption, Heading } from './Text';

type SectionHeaderProps = { title: string; subtitle?: string };

export function SectionHeader({ title, subtitle }: SectionHeaderProps) {
  return (
    <View style={styles.header}>
      <Heading>{title}</Heading>
      {subtitle ? <Caption>{subtitle}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({ header: { gap: spacing.xxs } });
