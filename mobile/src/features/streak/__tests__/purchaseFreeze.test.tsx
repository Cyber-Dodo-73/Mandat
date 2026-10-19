import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { purchaseFreeze } from '../api';
import { usePurchaseFreeze } from '../queries';

jest.mock('../api', () => ({ purchaseFreeze: jest.fn() }));
jest.mock('expo-crypto', () => ({ randomUUID: jest.fn() }));
jest.mock('@/lib/sounds', () => ({ playSound: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

const purchaseMock = purchaseFreeze as jest.MockedFunction<typeof purchaseFreeze>;

const bought = { currency: 'influence' as const, price: 200, freezes: 2, maxFreezes: 2, influence: 300 };

function wrapper({ children }: { children: ReactNode }) {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: 0 } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

function keys() {
  let counter = 0;
  return () => `key-${++counter}`;
}

describe('usePurchaseFreeze', () => {
  beforeEach(() => purchaseMock.mockReset());

  it('reuses the idempotency key when a failed purchase is retried', async () => {
    purchaseMock.mockRejectedValueOnce(new Error('timeout')).mockResolvedValueOnce(bought);
    const newKey = keys();
    const { result } = await renderHook(() => usePurchaseFreeze(newKey), { wrapper });

    await act(() => result.current.purchase('influence'));
    await waitFor(() => expect(result.current.isError).toBe(true));
    await act(() => result.current.purchase('influence'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(purchaseMock.mock.calls.map((call) => call[1])).toEqual(['key-1', 'key-1']);
    expect(purchaseMock.mock.calls[0]?.[0]).toBe('influence');
  });

  it('starts a new key after a successful purchase', async () => {
    purchaseMock.mockResolvedValue(bought);
    const newKey = keys();
    const { result } = await renderHook(() => usePurchaseFreeze(newKey), { wrapper });

    await act(() => result.current.purchase('influence'));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await act(() => result.current.purchase('influence'));
    await waitFor(() => expect(purchaseMock).toHaveBeenCalledTimes(2));

    expect(purchaseMock.mock.calls.map((call) => call[1])).toEqual(['key-1', 'key-2']);
  });
});
