import { StyleSheet, View } from 'react-native';

import { Body, Button3D, Heading, Icon, Text } from '@/components/ui';
import { useCountdown } from '@/hooks/useCountdown';
import { formatCountdown, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

import type { StreakView } from './api';
import { streakPalette } from './palette';
import { useRepairStreak } from './queries';

/** "Your streak just broke: get it back" (free, once a month, within 24 hours). */
export function RepairOffer({ streak, online }: { streak: StreakView; online: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const repair = useRepairStreak();
  const offer = streak.repair;
  const secondsLeft = useCountdown(offer.available ? (offer.expiresAt ?? null) : null);
  if (!offer.available || offer.restoresTo == null) return null;

  return (
    <View style={[styles.card, { backgroundColor: colors.dangerEdge, borderColor: colors.danger }]}>
      <View style={styles.head}>
        <View style={[styles.icon, { backgroundColor: colors.danger }]}>
          <Icon name="bandage" size={26} color={colors.onDanger} />
        </View>
        <View style={styles.flex}>
          <Heading color="#FFFFFF">{t('streak.repair.title', { count: offer.restoresTo })}</Heading>
          <Text variant="label" color={streakPalette.flameHot}>
            {t('streak.repair.expires', { time: formatCountdown(secondsLeft) })}
          </Text>
        </View>
      </View>
      <Body color="#FFFFFF">{t('streak.repair.body')}</Body>
      <Button3D
        label={t('streak.repair.button', { count: offer.restoresTo })}
        icon="flame"
        fullWidth
        disabled={!online}
        loading={repair.isPending}
        onPress={() => repair.mutate()}
      />
      {repair.isError ? (
        <Text accessibilityRole="alert" variant="label" color="#FFFFFF">
          {describeError(repair.error, t)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, padding: spacing.md, borderRadius: radius, borderWidth: 3 },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  icon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1 },
});
