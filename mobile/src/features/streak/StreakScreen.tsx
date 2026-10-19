import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Body, Caption, ScreenContainer } from '@/components/ui';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { spacing } from '@/theme';

import { statusMap, weekStrip } from './calendar';
import { FreezeInventory } from './FreezeInventory';
import { FriendStreaksSection } from './FriendStreaksSection';
import { MilestoneTrack } from './MilestoneTrack';
import { RepairOffer } from './RepairOffer';
import { StreakCalendar } from './StreakCalendar';
import { StreakHero } from './StreakHero';
import { StreakShareCard } from './StreakShareCard';
import { useStreakHistoryQuery, useStreakQuery } from './queries';

/** Duolingo-like streak screen, opened from the hub's flame. */
export function StreakScreen() {
  const { t } = useTranslation();
  const online = useIsOnline();
  const streak = useStreakQuery();
  const history = useStreakHistoryQuery();
  const statuses = useMemo(() => statusMap(history.data?.days), [history.data]);
  const data = streak.data;
  const week = useMemo(() => (data ? weekStrip(data.today, statuses) : []), [data, statuses]);

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <ScreenHeader title={t('streak.title')} />
      {!online ? <OfflineNotice /> : null}
      {!data ? (
        streak.isError ? (
          <Body tone="muted">{describeError(streak.error, t)}</Body>
        ) : (
          <Caption>{t('common.loading')}</Caption>
        )
      ) : (
        <View style={styles.content}>
          <StreakHero streak={data} week={week} />
          <RepairOffer streak={data} online={online} />
          <FreezeInventory streak={data} online={online} />
          <MilestoneTrack streak={data} />
          <StreakCalendar today={data.today} statuses={statuses} />
          <FriendStreaksSection online={online} />
          <StreakShareCard streak={data} />
        </View>
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
});
