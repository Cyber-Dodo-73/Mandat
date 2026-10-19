import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { openPack } from '../api';
import { useOpenPackAttempt } from '../queries';

jest.mock('../api', () => ({ openPack: jest.fn(), fetchPacks: jest.fn(), fetchPackOdds: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: () => 'key-sync' }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const openPackMock = openPack as jest.MockedFunction<typeof openPack>;

const result = {
  openingId: 'opening-1',
  packId: 's1-standard',
  cards: [],
  influenceGained: 0,
  pity: { packsSinceEpic: 1, packsSinceLegendary: 1, epicIn: 9, legendaryIn: 39 },
  freePacks: { stock: 0, maxStock: 2, nextFreePackAt: null },
  bonusPacks: 0,
};

function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return { invalidate, wrapper };
}

describe('pack opening refreshes', () => {
  beforeEach(() => openPackMock.mockReset());

  it('waits for the reveal before refetching collection, progression and /me, then refreshes once', async () => {
    openPackMock.mockResolvedValue(result);
    const { invalidate, wrapper } = setup();
    const { result: hook } = await renderHook(() => useOpenPackAttempt('s1-standard'), { wrapper });

    await act(() => hook.current.open());
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    // A level-up modal or a collection rerender must not land on top of the reveal.
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => hook.current.syncAfterReveal());
    expect(invalidate).toHaveBeenCalledTimes(3);

    await act(async () => hook.current.syncAfterReveal());
    expect(invalidate).toHaveBeenCalledTimes(3);
  });

  it('a slow network leaves nothing to sync until the result arrives', async () => {
    let resolve: (value: typeof result) => void = () => undefined;
    openPackMock.mockImplementation(() => new Promise((done) => (resolve = done)));
    const { invalidate, wrapper } = setup();
    const { result: hook } = await renderHook(() => useOpenPackAttempt('s1-standard'), { wrapper });

    await act(async () => void hook.current.open());
    await waitFor(() => expect(hook.current.isPending).toBe(true));
    await act(async () => hook.current.syncAfterReveal());
    expect(invalidate).not.toHaveBeenCalled();

    await act(async () => resolve(result));
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));
    await act(async () => hook.current.syncAfterReveal());
    expect(invalidate).toHaveBeenCalledTimes(3);
  });
});
