import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { collectionQueryKey } from '@/features/packs/queries';
import { meQueryKey, progressionQueryKey } from '@/features/player/queries';
import { api, unwrap, type components } from '@/lib/api';
import type { CardFinish } from '@/types/card';

export type CollectionResponse = components['schemas']['CollectionResponse'];
export type OwnedCard = components['schemas']['OwnedCardDto'];
export type RecycleResponse = components['schemas']['RecycleResponse'];
export type CraftResponse = components['schemas']['CraftResponse'];

/** Cards owned by the player, one item per card + finish (persisted for offline use). */
export function useCollectionQuery() {
  return useQuery<CollectionResponse>({
    queryKey: collectionQueryKey,
    queryFn: () => unwrap(api.GET('/api/v1/collection')),
  });
}

/** Copies of one card, per finish. */
export function useOwnedCopies(cardId: string): OwnedCard[] {
  const collection = useCollectionQuery();
  return collection.data?.items.filter((item) => item.cardId === cardId) ?? [];
}

type Snapshot = { previous: CollectionResponse | undefined };

function patchCollection(
  client: QueryClient,
  update: (items: OwnedCard[]) => OwnedCard[],
): Snapshot {
  const previous = client.getQueryData<CollectionResponse>(collectionQueryKey);
  if (previous) {
    const items = update(previous.items);
    client.setQueryData<CollectionResponse>(collectionQueryKey, {
      items,
      distinctCards: new Set(items.map((item) => item.cardId)).size,
      totalCopies: items.reduce((sum, item) => sum + item.quantity, 0),
    });
  }
  return { previous };
}

/** Influence and XP change with every recycle or craft: refresh what shows them. */
async function refreshAfterEconomy(client: QueryClient): Promise<void> {
  await Promise.all([
    client.invalidateQueries({ queryKey: collectionQueryKey }),
    client.invalidateQueries({ queryKey: progressionQueryKey }),
    client.invalidateQueries({ queryKey: meQueryKey }),
  ]);
}

type RecycleInput = { cardId: string; finish: CardFinish; quantity: number };

/** Recycles duplicates into Influence. The grid updates at once; the server stays the truth. */
export function useRecycleMutation() {
  const client = useQueryClient();
  return useMutation<RecycleResponse, Error, RecycleInput, Snapshot>({
    mutationFn: ({ cardId, finish, quantity }) =>
      unwrap(api.POST('/api/v1/collection/{cardId}/recycle', { params: { path: { cardId } }, body: { finish, quantity } })),
    onMutate: async ({ cardId, finish, quantity }) => {
      await client.cancelQueries({ queryKey: collectionQueryKey });
      return patchCollection(client, (items) =>
        items.map((item) =>
          item.cardId === cardId && item.finish === finish
            ? { ...item, quantity: Math.max(1, item.quantity - quantity) }
            : item,
        ),
      );
    },
    onError: (_error, _input, snapshot) => {
      if (snapshot?.previous) client.setQueryData(collectionQueryKey, snapshot.previous);
    },
    onSettled: () => refreshAfterEconomy(client),
  });
}

/** Crafts a missing card (standard finish) with Influence. */
export function useCraftMutation() {
  const client = useQueryClient();
  return useMutation<CraftResponse, Error, { cardId: string }, Snapshot>({
    mutationFn: ({ cardId }) => unwrap(api.POST('/api/v1/collection/{cardId}/craft', { params: { path: { cardId } } })),
    onMutate: async ({ cardId }) => {
      await client.cancelQueries({ queryKey: collectionQueryKey });
      const now = new Date().toISOString();
      return patchCollection(client, (items) => [
        ...items,
        { cardId, finish: 'standard', quantity: 1, firstObtainedAt: now, lastObtainedAt: now },
      ]);
    },
    onError: (_error, _input, snapshot) => {
      if (snapshot?.previous) client.setQueryData(collectionQueryKey, snapshot.previous);
    },
    onSettled: () => refreshAfterEconomy(client),
  });
}
