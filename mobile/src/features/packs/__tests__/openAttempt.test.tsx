import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { openPack } from '../api';
import { useOpenPackAttempt } from '../queries';

jest.mock('../api', () => ({ openPack: jest.fn(), fetchPacks: jest.fn(), fetchPackOdds: jest.fn() }));
jest.mock('expo-crypto', () => {
  let counter = 0;
  return { randomUUID: () => `key-${++counter}` };
});
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
  pity: { packsSinceEpic: 1, packsSinceLegendary: 1 },
  freePacks: { stock: 0, maxStock: 2, nextFreePackAt: null },
  bonusPacks: 0,
};

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe('useOpenPackAttempt', () => {
  beforeEach(() => openPackMock.mockReset());

  it('reuses the same idempotency key when the opening is retried', async () => {
    openPackMock.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(result);
    const { result: hook } = await renderHook(() => useOpenPackAttempt('s1-standard'), { wrapper });

    await act(() => hook.current.open());
    await waitFor(() => expect(hook.current.isError).toBe(true));
    await act(() => hook.current.open());
    await waitFor(() => expect(hook.current.isSuccess).toBe(true));

    expect(openPackMock).toHaveBeenCalledTimes(2);
    const [first, second] = openPackMock.mock.calls;
    expect(first?.[1]).toBe(second?.[1]);
    expect(first?.[1]).toBe(hook.current.idempotencyKey);
  });

  it('uses a new key for a new opening attempt', async () => {
    const first = await renderHook(() => useOpenPackAttempt('s1-standard'), { wrapper });
    const second = await renderHook(() => useOpenPackAttempt('s1-standard'), { wrapper });
    expect(first.result.current.idempotencyKey).not.toBe(second.result.current.idempotencyKey);
  });
});
