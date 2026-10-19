import { useQuery } from '@tanstack/react-query';

import { api, unwrap, type components } from '@/lib/api';

export type Me = components['schemas']['MeResponse'];
export type Progression = components['schemas']['ProgressionResponse'];

export const meQueryKey = ['me'] as const;
export const progressionQueryKey = ['progression'] as const;

/** Account, settings and wallet of the signed-in player. */
export function useMeQuery() {
  return useQuery<Me>({ queryKey: meQueryKey, queryFn: () => unwrap(api.GET('/api/v1/me')) });
}

/** Level, XP, streak and wallet: everything the home top bar shows. */
export function useProgressionQuery() {
  return useQuery<Progression>({
    queryKey: progressionQueryKey,
    queryFn: () => unwrap(api.GET('/api/v1/progression')),
  });
}
