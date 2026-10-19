import type { Friend } from '@/features/social/queries';
import { storage } from '@/lib/storage';

import type { FriendStreak, FriendStreaksView } from './api';

/** Friend streak milestones (same days as the personal ones, see the API's StreakMilestones). */
export const FRIEND_STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 365] as const;

/** Today's state of a shared streak, from my side. */
export type FriendStreakToday = 'broken' | 'bothDone' | 'waitingFriend' | 'waitingMe' | 'neither';

export function friendStreakToday(streak: Pick<FriendStreak, 'current' | 'meDoneToday' | 'friendDoneToday'>): FriendStreakToday {
  if (streak.meDoneToday && streak.friendDoneToday) return 'bothDone';
  if (streak.current === 0) return 'broken';
  if (streak.meDoneToday) return 'waitingFriend';
  if (streak.friendDoneToday) return 'waitingMe';
  return 'neither';
}

/** The friend can be nudged when they haven't played their day yet. */
export function canNudgeInStreak(streak: Pick<FriendStreak, 'friendDoneToday'>): boolean {
  return !streak.friendDoneToday;
}

/** "Relancer" button of the friends list: hidden for active friends, disabled once sent today. */
export type NudgeButton = 'hidden' | 'sent' | 'available';

export function nudgeButton(friend: Pick<Friend, 'activeToday' | 'nudgedToday'>): NudgeButton {
  if (friend.activeToday) return 'hidden';
  return friend.nudgedToday ? 'sent' : 'available';
}

/** Where a friend stands for a friend streak invitation from the friends list. */
export type FriendStreakLink = 'active' | 'invited' | 'incoming' | 'full' | 'available';

export function friendStreakLink(view: FriendStreaksView | undefined, friendCode: string): FriendStreakLink {
  if (!view) return 'full';
  if (view.streaks.some((streak) => streak.friend.friendCode === friendCode)) return 'active';
  if (view.outgoing.some((invite) => invite.friend.friendCode === friendCode)) return 'invited';
  if (view.incoming.some((invite) => invite.friend.friendCode === friendCode)) return 'incoming';
  const used = view.streaks.length + view.outgoing.length;
  return used >= view.maxFriendStreaks ? 'full' : 'available';
}

const CELEBRATED_KEY = 'friendStreak.celebrated';

const celebrationKey = (streak: Pick<FriendStreak, 'id' | 'current'>) => `${streak.id}:${streak.current}`;

/** Shared streaks that reached a milestone today and weren't celebrated yet on this device. */
export function milestonesToCelebrate(streaks: readonly FriendStreak[], celebrated: ReadonlySet<string>): FriendStreak[] {
  return streaks.filter(
    (streak) =>
      streak.meDoneToday &&
      streak.friendDoneToday &&
      (FRIEND_STREAK_MILESTONES as readonly number[]).includes(streak.current) &&
      !celebrated.has(celebrationKey(streak)),
  );
}

export function readCelebrated(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(storage.getItem(CELEBRATED_KEY) ?? '[]');
    return new Set(Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : []);
  } catch {
    return new Set();
  }
}

export function markCelebrated(streak: Pick<FriendStreak, 'id' | 'current'>): void {
  // Only the latest milestones matter: keep the list short.
  const next = [...readCelebrated(), celebrationKey(streak)].slice(-50);
  storage.setItem(CELEBRATED_KEY, JSON.stringify(next));
}
