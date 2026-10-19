import { StyleSheet, View } from 'react-native';

import { Badge } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { spacing } from '@/theme';

import type { Reward } from './api';
import { loose, rewardParts } from './labels';

/** "+50 XP · +20 Influence · +1 booster" as small badges. */
export function RewardChips({ reward, color, textColor }: { reward: Reward; color?: string; textColor?: string }) {
  const { t } = useTranslation();
  const parts = rewardParts(loose(t), reward);
  if (parts.length === 0) return null;
  return (
    <View style={styles.row} accessible accessibilityLabel={parts.join(', ')}>
      {parts.map((part) => (
        <Badge key={part} label={part} color={color} textColor={textColor} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xxs },
});
