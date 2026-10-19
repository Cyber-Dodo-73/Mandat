import { addZonedDays, dayKey, zonedParts, zonedTimeToEpoch } from './zonedTime';

export type NotificationKind = 'packReady' | 'streakAtRisk';

export type PlannedNotification = { kind: NotificationKind; at: number };

export type NotificationPlanInput = {
  now: number;
  /** Settings toggle (and OS permission): nothing is planned when off. */
  enabled: boolean;
  /** Player's timezone, from the server. */
  timeZone: string;
  /** Server time of the next free booster, null when the stock is full. */
  nextFreePackAt: number | null;
  currentStreak: number;
  streakActiveToday: boolean;
};

/** Evening reminder when the streak would be lost (player's local time). */
export const STREAK_REMINDER_HOUR = 20;
/** Nothing is ever delivered between 22:00 and 09:00 local time: it is moved to 09:00. */
export const QUIET_START_HOUR = 22;
export const QUIET_END_HOUR = 9;

function outOfQuietHours(at: number, timeZone: string): number {
  const local = zonedParts(at, timeZone);
  if (local.hour >= QUIET_END_HOUR && local.hour < QUIET_START_HOUR) return at;
  const morning = { ...local, hour: QUIET_END_HOUR, minute: 0 };
  return zonedTimeToEpoch(local.hour >= QUIET_START_HOUR ? addZonedDays(morning, 1) : morning, timeZone);
}

/**
 * Local notifications to schedule from the current server state. At most one notification per
 * calendar day (the brief's default): the streak reminder wins over "booster ready" on the same
 * day. Only real server dates are used, never invented pressure.
 */
export function planNotifications(input: NotificationPlanInput): PlannedNotification[] {
  if (!input.enabled) return [];
  const candidates: PlannedNotification[] = [];

  if (input.currentStreak > 0 && !input.streakActiveToday) {
    const today = zonedParts(input.now, input.timeZone);
    const reminder = zonedTimeToEpoch({ ...today, hour: STREAK_REMINDER_HOUR, minute: 0 }, input.timeZone);
    if (reminder > input.now) candidates.push({ kind: 'streakAtRisk', at: reminder });
  }

  if (input.nextFreePackAt !== null && input.nextFreePackAt > input.now) {
    candidates.push({ kind: 'packReady', at: outOfQuietHours(input.nextFreePackAt, input.timeZone) });
  }

  const usedDays = new Set<string>();
  const planned: PlannedNotification[] = [];
  for (const candidate of candidates) {
    const day = dayKey(candidate.at, input.timeZone);
    if (usedDays.has(day)) continue;
    usedDays.add(day);
    planned.push(candidate);
  }
  return planned.sort((a, b) => a.at - b.at);
}
