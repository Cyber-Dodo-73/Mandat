import { StyleSheet, View } from 'react-native';

import { Caption, Text } from '@/components/ui';
import { METAL_COLORS, type BadgeItem } from '@/features/profile/badges';
import { useTranslation } from '@/i18n';
import { spacing } from '@/theme';

import { CosmeticEmblem } from './CosmeticEmblem';

const MEDAL = 56;

/** Achievement medals: earned ones in their metal, the others greyed with their progress. */
export function BadgeGrid({ badges, limit }: { badges: readonly BadgeItem[]; limit?: number }) {
  const { t } = useTranslation();
  const shown = limit ? badges.slice(0, limit) : badges;
  return (
    <View style={styles.grid}>
      {shown.map((badge) => {
        const family = badge.family ? t(`profile.badges.families.${badge.family}` as 'profile.badges.families.packs') : badge.id;
        const label = badge.unlocked
          ? t('profile.badges.unlocked', { family, threshold: badge.threshold })
          : t('profile.badges.locked', { family, threshold: badge.threshold, percent: Math.round(badge.progress * 100) });
        return (
          <View key={badge.id} accessible accessibilityLabel={label} style={styles.cell}>
            <CosmeticEmblem
              kind="badge"
              id={badge.id}
              size={MEDAL}
              locked={!badge.unlocked}
              tint={badge.unlocked ? METAL_COLORS[badge.metal] : undefined}
            />
            <Text variant="caption" align="center" numberOfLines={1} tone={badge.unlocked ? 'default' : 'muted'}>
              {badge.threshold}
            </Text>
          </View>
        );
      })}
      {shown.length === 0 ? <Caption>{t('profile.badges.none')}</Caption> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  cell: { width: MEDAL + spacing.xs, alignItems: 'center', gap: 2 },
});
