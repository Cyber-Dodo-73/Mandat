import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { usePacksQuery } from '@/features/packs/queries';
import { useProgressionQuery } from '@/features/player/queries';
import { useSettingsStore } from '@/features/settings/store';
import { useTranslation } from '@/i18n';
import { parseInstant } from '@/lib/time';

import { planNotifications } from './notificationPlan';
import {
  applyNotificationPlan,
  configureNotifications,
  getNotificationPermission,
  requestNotificationPermission,
  type NotificationPermission,
} from './notifications';

/** Current OS permission, refreshed when the app comes back to the foreground. */
export function useNotificationPermission() {
  const [permission, setPermission] = useState<NotificationPermission | null>(null);

  const refresh = useCallback(() => {
    void getNotificationPermission().then(setPermission);
  }, []);

  useEffect(() => {
    refresh();
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => subscription.remove();
  }, [refresh]);

  const request = useCallback(async () => {
    const next = await requestNotificationPermission();
    setPermission(next);
    return next;
  }, []);

  return { permission, request };
}

/**
 * Keeps local reminders in line with the server state: free booster ready, streak at risk in
 * the evening (player's timezone). Respects the settings toggle and the OS permission.
 */
export function useNotificationSync() {
  const { t } = useTranslation();
  const enabled = useSettingsStore((state) => state.notificationsEnabled);
  const progression = useProgressionQuery().data;
  const packs = usePacksQuery().data;
  const { permission } = useNotificationPermission();

  const nextFreePackAt = packs?.freePacks.nextFreePackAt ?? null;
  const streak = progression?.currentStreak ?? 0;
  const activeToday = progression?.streakActiveToday ?? false;
  const timeZone = progression?.timezone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    if (permission === null || !progression) return;
    const allowed = enabled && permission === 'granted';
    void configureNotifications(t('notifications.channel')).then(() =>
      applyNotificationPlan(
        planNotifications({
          now: Date.now(),
          enabled: allowed,
          timeZone,
          nextFreePackAt: nextFreePackAt ? parseInstant(nextFreePackAt) : null,
          currentStreak: streak,
          streakActiveToday: activeToday,
        }),
        {
          packReady: { title: t('notifications.packReady.title'), body: t('notifications.packReady.body') },
          streakAtRisk: {
            title: t('notifications.streakAtRisk.title'),
            body: t('notifications.streakAtRisk.body', { count: streak }),
          },
        },
      ),
    );
  }, [activeToday, enabled, nextFreePackAt, permission, progression, streak, t, timeZone]);
}
