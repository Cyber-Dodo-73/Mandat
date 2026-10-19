import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { packsQueryKey } from '@/features/packs/queries';
import { meQueryKey, progressionQueryKey } from '@/features/player/queries';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';

import {
  claimMission,
  claimSeasonTier,
  fetchAchievements,
  fetchMissions,
  fetchSeasonPass,
  type AchievementsView,
  type ClaimResult,
  type MissionsView,
  type SeasonPassView,
} from './api';
import { isEmptyReward, useCelebrations } from './celebrations';
import { writeLastSeenLevel } from './returnRecap';

export const missionsQueryKey = ['missions'] as const;
export const achievementsQueryKey = ['achievements'] as const;
export const seasonPassQueryKey = ['season-pass'] as const;

export function useMissionsQuery() {
  return useQuery<MissionsView>({ queryKey: missionsQueryKey, queryFn: fetchMissions });
}

export function useAchievementsQuery(enabled = true) {
  return useQuery<AchievementsView>({ queryKey: achievementsQueryKey, queryFn: fetchAchievements, enabled });
}

export function useSeasonPassQuery(enabled = true) {
  return useQuery<SeasonPassView>({ queryKey: seasonPassQueryKey, queryFn: fetchSeasonPass, enabled });
}

/** Everything a reward can change on screen: wallet, level, boosters, missions, pass. */
function refreshAfterReward(queryClient: QueryClient) {
  for (const queryKey of [progressionQueryKey, meQueryKey, packsQueryKey, missionsQueryKey, seasonPassQueryKey, achievementsQueryKey]) {
    void queryClient.invalidateQueries({ queryKey });
  }
}

/** Level-ups come back with the claim: celebrate them right away, with their rewards. */
function celebrate(result: ClaimResult) {
  const { push } = useCelebrations.getState();
  if (!isEmptyReward(result.reward)) push({ type: 'reward', reward: result.reward });
  if (result.levelsGained.length > 0) {
    writeLastSeenLevel(result.level);
    push({ type: 'levelUp', level: result.level, rewards: isEmptyReward(result.levelRewards) ? null : result.levelRewards });
  }
}

export function useClaimMission() {
  const queryClient = useQueryClient();
  return useMutation<ClaimResult, Error, string>({
    mutationFn: claimMission,
    onSuccess: (result) => {
      haptics.missionComplete();
      playSound('mission_complete');
      celebrate(result);
      refreshAfterReward(queryClient);
    },
    onError: () => haptics.error(),
  });
}

export function useClaimSeasonTier() {
  const queryClient = useQueryClient();
  return useMutation<ClaimResult, Error, number>({
    mutationFn: claimSeasonTier,
    onSuccess: (result) => {
      haptics.missionComplete();
      playSound('mission_complete');
      celebrate(result);
      refreshAfterReward(queryClient);
    },
    onError: () => haptics.error(),
  });
}
