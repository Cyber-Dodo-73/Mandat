import { useMutation, useQuery } from '@tanstack/react-query';

import { fetchPacksMock, openPackMock } from './mockApi';
import type { PackOpenResult, PacksResponse } from './types';

export const packsQueryKey = ['packs'] as const;

/** TODO(phase 5): swap the mock for `GET /packs` through the generated client. */
export function usePacksQuery() {
  return useQuery<PacksResponse>({ queryKey: packsQueryKey, queryFn: fetchPacksMock });
}

/** TODO(phase 5): `POST /packs/{packId}/open` with an `Idempotency-Key` header. */
export function useOpenPackMutation() {
  return useMutation<PackOpenResult, Error, string>({ mutationFn: openPackMock });
}
