import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { meQueryKey } from '@/features/player/queries';
import { api, unwrap, type components } from '@/lib/api';

export type MyProfile = components['schemas']['MyProfile'];
export type PublicProfile = components['schemas']['PublicProfile'];
export type ProfileUpdate = components['schemas']['UpdateProfileRequest'];
export type CompareResponse = components['schemas']['CompareResponse'];
export type AchievementsResponse = components['schemas']['AchievementsResponse'];
export type Achievement = components['schemas']['AchievementDto'];

export const myProfileQueryKey = ['profile', 'me'] as const;
export const publicProfileQueryKey = (friendCode: string) => ['profile', 'public', friendCode] as const;
export const compareQueryKey = (friendCode: string) => ['profile', 'compare', friendCode] as const;
export const profileAchievementsQueryKey = ['profile', 'achievements'] as const;

/** My profile, its visibility and the cosmetics I can pick (persisted for offline use). */
export function useMyProfileQuery() {
  return useQuery<MyProfile>({
    queryKey: myProfileQueryKey,
    queryFn: () => unwrap(api.GET('/api/v1/profile/me')),
  });
}

/** Every achievement with its progress, for the badge grid. */
export function useProfileAchievementsQuery() {
  return useQuery<AchievementsResponse>({
    queryKey: profileAchievementsQueryKey,
    queryFn: () => unwrap(api.GET('/api/v1/achievements')),
  });
}

/** The request the server expects, rebuilt from what it last sent. */
export function toUpdate(profile: MyProfile): ProfileUpdate {
  return {
    avatarId: profile.profile.avatarId,
    bannerId: profile.profile.bannerId,
    titleId: profile.profile.titleId ?? null,
    favoriteCard: profile.profile.favoriteCard,
    showcase: profile.profile.showcase,
    visibility: profile.visibility,
  };
}

/** Applies an update to the cached profile, so the screen changes before the server answers. */
function applyUpdate(profile: MyProfile, update: ProfileUpdate): MyProfile {
  return {
    ...profile,
    visibility: update.visibility,
    profile: {
      ...profile.profile,
      avatarId: update.avatarId,
      bannerId: update.bannerId,
      titleId: update.titleId ?? null,
      favoriteCard: update.favoriteCard,
      showcase: update.showcase,
    },
  };
}

/**
 * Replaces the editable part of my profile (PUT is a full replacement): optimistic, rolled
 * back on error, then refreshed from the server, which validates ownership and unlocks.
 */
export function useUpdateProfileMutation() {
  const client = useQueryClient();
  return useMutation<MyProfile, Error, (current: ProfileUpdate) => ProfileUpdate, { previous?: MyProfile }>({
    mutationFn: async (change) => {
      const current = client.getQueryData<MyProfile>(myProfileQueryKey);
      if (!current) throw new Error('Profile not loaded');
      return unwrap(api.PUT('/api/v1/profile/me', { body: change(toUpdate(current)) }));
    },
    onMutate: async (change) => {
      await client.cancelQueries({ queryKey: myProfileQueryKey });
      const previous = client.getQueryData<MyProfile>(myProfileQueryKey);
      if (previous) client.setQueryData(myProfileQueryKey, applyUpdate(previous, change(toUpdate(previous))));
      return { previous };
    },
    onError: (_error, _change, context) => {
      if (context?.previous) client.setQueryData(myProfileQueryKey, context.previous);
    },
    onSuccess: (profile) => client.setQueryData(myProfileQueryKey, profile),
  });
}

/** Nickname change (moderated, cooldown enforced by the server). */
export function useChangeNicknameMutation() {
  const client = useQueryClient();
  return useMutation<MyProfile, Error, string>({
    mutationFn: (nickname) => unwrap(api.PUT('/api/v1/profile/me/nickname', { body: { nickname } })),
    onSuccess: async (profile) => {
      client.setQueryData(myProfileQueryKey, profile);
      await client.invalidateQueries({ queryKey: meQueryKey });
    },
  });
}

/** Another player's public profile (private ones: friends only). */
export function usePublicProfileQuery(friendCode: string) {
  return useQuery<PublicProfile>({
    queryKey: publicProfileQueryKey(friendCode),
    queryFn: () => unwrap(api.GET('/api/v1/profiles/{friendCode}', { params: { path: { friendCode } } })),
    enabled: friendCode.length > 0,
    retry: false,
  });
}

/** Cards they have that I don't, and the reverse. */
export function useCompareQuery(friendCode: string, enabled: boolean) {
  return useQuery<CompareResponse>({
    queryKey: compareQueryKey(friendCode),
    queryFn: () => unwrap(api.GET('/api/v1/profiles/{friendCode}/compare', { params: { path: { friendCode } } })),
    enabled: enabled && friendCode.length > 0,
    retry: false,
  });
}
