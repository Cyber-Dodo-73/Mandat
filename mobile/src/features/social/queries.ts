import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { publicProfileQueryKey } from '@/features/profile/queries';
import { api, unwrap, type components } from '@/lib/api';

export type FriendsResponse = components['schemas']['FriendsResponse'];
export type Friend = components['schemas']['FriendDto'];
export type AddFriendResult = components['schemas']['AddFriendResponse']['result'];
export type ReportReason = components['schemas']['ReportRequest']['reason'];

export const REPORT_REASONS: readonly ReportReason[] = [
  'offensive_nickname',
  'inappropriate_profile',
  'cheating',
  'harassment',
  'other',
];

export const friendsQueryKey = ['friends'] as const;

/** Friends, requests I received and requests I sent. */
export function useFriendsQuery() {
  return useQuery<FriendsResponse>({
    queryKey: friendsQueryKey,
    queryFn: () => unwrap(api.GET('/api/v1/friends')),
  });
}

/** Sends a request by friend code, or accepts theirs if they asked first. */
export function useAddFriendMutation() {
  const client = useQueryClient();
  return useMutation<components['schemas']['AddFriendResponse'], Error, string>({
    mutationFn: (friendCode) => unwrap(api.POST('/api/v1/friends', { body: { friendCode } })),
    onSuccess: async (response, friendCode) => {
      client.setQueryData(friendsQueryKey, response.friends);
      await client.invalidateQueries({ queryKey: publicProfileQueryKey(friendCode) });
    },
  });
}

/** Accepts a request I received. */
export function useAcceptFriendMutation() {
  const client = useQueryClient();
  return useMutation<FriendsResponse, Error, string>({
    mutationFn: (friendCode) =>
      unwrap(api.POST('/api/v1/friends/{friendCode}/accept', { params: { path: { friendCode } } })),
    onSuccess: async (friends, friendCode) => {
      client.setQueryData(friendsQueryKey, friends);
      await client.invalidateQueries({ queryKey: publicProfileQueryKey(friendCode) });
    },
  });
}

/** Removes a friend, cancels a request I sent or declines one I received. */
export function useRemoveFriendMutation() {
  const client = useQueryClient();
  return useMutation<FriendsResponse, Error, string>({
    mutationFn: (friendCode) =>
      unwrap(api.DELETE('/api/v1/friends/{friendCode}', { params: { path: { friendCode } } })),
    onSuccess: async (friends, friendCode) => {
      client.setQueryData(friendsQueryKey, friends);
      await client.invalidateQueries({ queryKey: publicProfileQueryKey(friendCode) });
    },
  });
}

type ReportInput = { friendCode: string; reason: ReportReason; note?: string };

export type BlockedPlayer = components['schemas']['BlockedPlayerDto'];

export const blocksQueryKey = ['blocks'] as const;

/** Players I blocked (settings). */
export function useBlocksQuery() {
  return useQuery<BlockedPlayer[]>({ queryKey: blocksQueryKey, queryFn: () => unwrap(api.GET('/api/v1/blocks')) });
}

/** Blocks a player: the friendship ends and neither side can see or contact the other. */
export function useBlockMutation() {
  const client = useQueryClient();
  return useMutation<BlockedPlayer[], Error, string>({
    mutationFn: (friendCode) => unwrap(api.POST('/api/v1/blocks', { body: { friendCode } })),
    onSuccess: async (blocked, friendCode) => {
      client.setQueryData(blocksQueryKey, blocked);
      client.removeQueries({ queryKey: publicProfileQueryKey(friendCode) });
      await client.invalidateQueries({ queryKey: friendsQueryKey });
    },
  });
}

export function useUnblockMutation() {
  const client = useQueryClient();
  return useMutation<BlockedPlayer[], Error, string>({
    mutationFn: (friendCode) =>
      unwrap(api.DELETE('/api/v1/blocks/{friendCode}', { params: { path: { friendCode } } })),
    onSuccess: (blocked) => client.setQueryData(blocksQueryKey, blocked),
  });
}

/** Reports a profile to the moderators; never shown publicly. */
export function useReportMutation() {
  return useMutation<unknown, Error, ReportInput>({
    mutationFn: ({ friendCode, reason, note }) =>
      unwrap(api.POST('/api/v1/reports', { body: { friendCode, reason, note: note?.trim() || null } })),
  });
}
