import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { refreshAfterGame } from '@/features/quiz/api';
import { api, unwrap, type components } from '@/lib/api';
import { storage } from '@/lib/storage';

export type Duel = components['schemas']['DuelResponse'];
export type DuelRound = components['schemas']['RoundOutcome'];
export type AppliedEffect = components['schemas']['AppliedEffect'];
export type Difficulty = Duel['difficulty'];
export type Domain = DuelRound['domain'];

export const DIFFICULTIES: readonly Difficulty[] = ['easy', 'normal', 'hard'];
export const TEAM_SIZE = 3;

const ACTIVE_KEY = 'duel.active';

export const duelKey = (id: string) => ['duel', id] as const;

/** Id of the duel in progress, kept on the device so it can be resumed. */
export const activeDuel = {
  get: (): string | null => storage.getItem(ACTIVE_KEY),
  set: (id: string) => storage.setItem(ACTIVE_KEY, id),
  clear: () => storage.removeItem(ACTIVE_KEY),
};

export function useDuel(id: string | null) {
  return useQuery<Duel>({
    queryKey: duelKey(id ?? 'none'),
    queryFn: () => unwrap(api.GET('/api/v1/duels/{duelId}', { params: { path: { duelId: id ?? '' } } })),
    enabled: Boolean(id),
    staleTime: 0,
    retry: false,
  });
}

/** Starts a duel with 3 owned cards; the server picks the AI team (and abandons any older duel). */
export function useCreateDuel() {
  const client = useQueryClient();
  return useMutation<Duel, Error, { cardIds: string[]; difficulty: Difficulty }>({
    mutationFn: (body) => unwrap(api.POST('/api/v1/duels', { body })),
    onSuccess: (duel) => {
      activeDuel.set(duel.id);
      client.setQueryData(duelKey(duel.id), duel);
    },
  });
}

/** Plays a card in the announced domain; the server resolves abilities and returns the new state. */
export function usePlayRound(duelId: string) {
  const client = useQueryClient();
  return useMutation<Duel, Error, string>({
    mutationFn: (cardId) =>
      unwrap(api.POST('/api/v1/duels/{duelId}/rounds', { params: { path: { duelId } }, body: { cardId } })),
    onSuccess: (duel) => {
      client.setQueryData(duelKey(duel.id), duel);
      if (duel.status !== 'active') {
        activeDuel.clear();
        refreshAfterGame(client);
      }
    },
  });
}
