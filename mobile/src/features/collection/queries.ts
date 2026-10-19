import { useQuery } from '@tanstack/react-query';

import { collectionQueryKey } from '@/features/packs/queries';
import { api, unwrap, type components } from '@/lib/api';

export type CollectionResponse = components['schemas']['CollectionResponse'];
export type OwnedCard = components['schemas']['OwnedCardDto'];

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
