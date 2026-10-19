import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Crypto from 'expo-crypto';
import { useCallback, useRef, useState } from 'react';

import { meQueryKey, progressionQueryKey } from '@/features/player/queries';

import { fetchPackOdds, fetchPacks, openPack } from './api';
import type { PackOdds, PackOpenResult, PacksView } from './types';

export const packsQueryKey = ['packs'] as const;
export const packOddsQueryKey = (packId: string) => ['packs', packId, 'odds'] as const;
export const collectionQueryKey = ['collection'] as const;

export function usePacksQuery() {
  return useQuery<PacksView>({ queryKey: packsQueryKey, queryFn: fetchPacks });
}

export function usePackOddsQuery(packId: string | undefined, enabled: boolean) {
  return useQuery<PackOdds>({
    queryKey: packOddsQueryKey(packId ?? ''),
    queryFn: () => fetchPackOdds(packId ?? ''),
    enabled: enabled && Boolean(packId),
    staleTime: 60 * 60_000,
  });
}

/**
 * One opening attempt of a pack. The idempotency key is created once per attempt and
 * reused by every retry, so a request that reached the server but whose answer was lost
 * never spends a second pack. A new attempt (new screen round) gets a new key.
 */
export function useOpenPackAttempt(packId: string) {
  const queryClient = useQueryClient();
  const [idempotencyKey] = useState(() => Crypto.randomUUID());
  const pendingSync = useRef(false);

  const mutation = useMutation<PackOpenResult, Error, void>({
    mutationKey: ['packs', packId, 'open', idempotencyKey],
    mutationFn: () => openPack(packId, idempotencyKey),
    onSuccess: (result) => {
      // The server's new stock and pity show up on the hub right away.
      queryClient.setQueryData<PacksView>(packsQueryKey, (previous) =>
        previous ? { ...previous, freePacks: result.freePacks, bonusPacks: result.bonusPacks, pity: result.pity } : previous,
      );
      // Collection, progression and /me are refreshed once the cards have been revealed (see
      // syncAfterReveal): refetching them now re-renders the tabs under the modal mid-animation,
      // and a level-up would pop its overlay over the cards being revealed.
      pendingSync.current = true;
    },
  });

  /** Refreshes what the opening changed. Idempotent: only the first call after a success runs. */
  const syncAfterReveal = useCallback(() => {
    if (!pendingSync.current) return;
    pendingSync.current = false;
    for (const queryKey of [collectionQueryKey, progressionQueryKey, meQueryKey]) {
      void queryClient.invalidateQueries({ queryKey });
    }
  }, [queryClient]);

  return { ...mutation, idempotencyKey, open: () => mutation.mutate(), syncAfterReveal };
}
