import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useRef } from 'react';

import { packsQueryKey } from '@/features/packs/queries';
import { meQueryKey, progressionQueryKey } from '@/features/player/queries';
import { friendsQueryKey, type FriendsResponse } from '@/features/social/queries';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';

import {
  acceptFriendStreak,
  declineFriendStreak,
  fetchFriendStreaks,
  fetchStreak,
  fetchStreakHistory,
  inviteFriendStreak,
  nudgeFriend,
  purchaseFreeze,
  removeFriendStreak,
  repairStreak,
  type FreezeCurrency,
  type FriendStreaksView,
  type NudgeResult,
  type PurchaseFreezeResult,
  type StreakHistory,
  type StreakView,
} from './api';

export const HISTORY_DAYS = 60;

export const streakQueryKey = ['streak'] as const;
export const streakHistoryQueryKey = ['streak', 'history', HISTORY_DAYS] as const;
export const friendStreaksQueryKey = ['friend-streaks'] as const;

export function useStreakQuery() {
  return useQuery<StreakView>({ queryKey: streakQueryKey, queryFn: fetchStreak });
}

export function useStreakHistoryQuery() {
  return useQuery<StreakHistory>({ queryKey: streakHistoryQueryKey, queryFn: () => fetchStreakHistory(HISTORY_DAYS) });
}

export function useFriendStreaksQuery(enabled = true) {
  return useQuery<FriendStreaksView>({ queryKey: friendStreaksQueryKey, queryFn: fetchFriendStreaks, enabled });
}

/** Streak, history and the hub's streak pill. */
function refreshStreak(queryClient: QueryClient) {
  for (const queryKey of [streakQueryKey, progressionQueryKey, meQueryKey]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

export function useRepairStreak() {
  const queryClient = useQueryClient();
  return useMutation<StreakView, Error, void>({
    mutationFn: repairStreak,
    onSuccess: (view) => {
      haptics.levelUp();
      playSound('level_up');
      queryClient.setQueryData(streakQueryKey, view);
      refreshStreak(queryClient);
      // Milestones reached again can grant boosters.
      void queryClient.invalidateQueries({ queryKey: packsQueryKey });
    },
    onError: () => haptics.error(),
  });
}

/**
 * Buying a freeze. One idempotency key per purchase attempt, reused by every retry of that
 * attempt (a lost answer never charges twice); a successful purchase starts a new attempt.
 */
export function usePurchaseFreeze(newKey: () => string = Crypto.randomUUID) {
  const queryClient = useQueryClient();
  const key = useRef<string | null>(null);

  const mutation = useMutation<PurchaseFreezeResult, Error, { currency: FreezeCurrency; idempotencyKey: string }>({
    mutationFn: ({ currency, idempotencyKey }) => purchaseFreeze(currency, idempotencyKey),
    onSuccess: (result) => {
      key.current = null;
      haptics.missionComplete();
      playSound('coin');
      queryClient.setQueryData<StreakView>(streakQueryKey, (previous) =>
        previous ? { ...previous, freezes: result.freezes, influence: result.influence } : previous,
      );
      refreshStreak(queryClient);
    },
    onError: () => haptics.error(),
  });

  const { mutate } = mutation;
  const purchase = useCallback(
    (currency: FreezeCurrency, options?: { onSuccess?: (result: PurchaseFreezeResult) => void }) => {
      key.current ??= newKey();
      mutate({ currency, idempotencyKey: key.current }, { onSuccess: (result) => options?.onSuccess?.(result) });
    },
    [mutate, newKey],
  );

  return { ...mutation, purchase };
}

function useFriendStreakMutation<T>(mutationFn: (input: T) => Promise<FriendStreaksView>, onDone?: () => void) {
  const queryClient = useQueryClient();
  return useMutation<FriendStreaksView, Error, T>({
    mutationFn,
    onSuccess: (view) => {
      queryClient.setQueryData(friendStreaksQueryKey, view);
      onDone?.();
    },
    onError: () => haptics.error(),
  });
}

export const useInviteFriendStreak = () => useFriendStreakMutation(inviteFriendStreak, () => haptics.tap());

export const useAcceptFriendStreak = () =>
  useFriendStreakMutation(acceptFriendStreak, () => {
    haptics.missionComplete();
    playSound('mission_complete');
  });

export const useDeclineFriendStreak = () => useFriendStreakMutation(declineFriendStreak);

export const useRemoveFriendStreak = () => useFriendStreakMutation(removeFriendStreak);

/** Nudges a friend; the friends list marks them as nudged right away. */
export function useNudgeFriend() {
  const queryClient = useQueryClient();
  return useMutation<NudgeResult, Error, string>({
    mutationFn: nudgeFriend,
    onSuccess: (_result, friendCode) => {
      haptics.tap();
      playSound('toggle');
      queryClient.setQueryData<FriendsResponse>(friendsQueryKey, (previous) =>
        previous
          ? {
              ...previous,
              friends: previous.friends.map((friend) => (friend.friendCode === friendCode ? { ...friend, nudgedToday: true } : friend)),
            }
          : previous,
      );
    },
    onError: () => {
      haptics.error();
      // Already sent or friend already active: the list catches up with the server.
      void queryClient.invalidateQueries({ queryKey: friendsQueryKey });
    },
  });
}
