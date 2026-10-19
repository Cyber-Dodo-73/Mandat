import { api, unwrap, type components } from '@/lib/api';

export type StreakView = components['schemas']['StreakResponse'];
export type StreakHistory = components['schemas']['StreakHistoryResponse'];
export type StreakDay = components['schemas']['StreakDayDto'];
export type StreakDayStatus = StreakDay['status'];
export type StreakMilestone = components['schemas']['MilestoneDto'];
export type NextMilestone = components['schemas']['NextMilestoneDto'];
export type FreezeCurrency = components['schemas']['PurchaseFreezeResponse']['currency'];
export type PurchaseFreezeResult = components['schemas']['PurchaseFreezeResponse'];
export type FriendStreaksView = components['schemas']['FriendStreaksResponse'];
export type FriendStreak = components['schemas']['FriendStreakDto'];
export type FriendStreakInvite = components['schemas']['FriendStreakInviteDto'];
export type NudgeResult = components['schemas']['NudgeResponse'];

export const fetchStreak = () => unwrap(api.GET('/api/v1/streak'));

export const fetchStreakHistory = (days: number) =>
  unwrap(api.GET('/api/v1/streak/history', { params: { query: { days } } }));

export const repairStreak = () => unwrap(api.POST('/api/v1/streak/repair'));

/**
 * Buys one streak freeze. The idempotency key identifies the purchase attempt: replaying it
 * after a lost answer returns the same purchase instead of spending twice.
 */
export const purchaseFreeze = (currency: FreezeCurrency, idempotencyKey: string) =>
  unwrap(
    api.POST('/api/v1/streak/freezes/purchase', {
      params: { header: { 'Idempotency-Key': idempotencyKey } },
      body: { currency },
    }),
  );

export const fetchFriendStreaks = () => unwrap(api.GET('/api/v1/friend-streaks'));

export const inviteFriendStreak = (friendCode: string) =>
  unwrap(api.POST('/api/v1/friend-streaks', { body: { friendCode } }));

export const acceptFriendStreak = (id: string) =>
  unwrap(api.POST('/api/v1/friend-streaks/{id}/accept', { params: { path: { id } } }));

export const declineFriendStreak = (id: string) =>
  unwrap(api.POST('/api/v1/friend-streaks/{id}/decline', { params: { path: { id } } }));

export const removeFriendStreak = (id: string) =>
  unwrap(api.DELETE('/api/v1/friend-streaks/{id}', { params: { path: { id } } }));

export const nudgeFriend = (friendCode: string) =>
  unwrap(api.POST('/api/v1/friends/{friendCode}/nudge', { params: { path: { friendCode } } }));
