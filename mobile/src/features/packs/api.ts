import { api, unwrap } from '@/lib/api';

import { toPackOdds, toPackOpenResult, toPacksView } from './adapters';
import type { PackOdds, PackOpenResult, PacksView } from './types';

export async function fetchPacks(): Promise<PacksView> {
  return toPacksView(await unwrap(api.GET('/api/v1/packs')));
}

export async function fetchPackOdds(packId: string): Promise<PackOdds> {
  return toPackOdds(await unwrap(api.GET('/api/v1/packs/{packId}/odds', { params: { path: { packId } } })));
}

/**
 * Asks the server to open a pack. The idempotency key identifies the opening attempt:
 * replaying it (after a timeout or a dropped connection) returns the same cards instead
 * of spending a second pack.
 */
export async function openPack(packId: string, idempotencyKey: string): Promise<PackOpenResult> {
  return toPackOpenResult(
    await unwrap(
      api.POST('/api/v1/packs/{packId}/open', {
        params: { path: { packId }, header: { 'Idempotency-Key': idempotencyKey } },
      }),
    ),
  );
}
