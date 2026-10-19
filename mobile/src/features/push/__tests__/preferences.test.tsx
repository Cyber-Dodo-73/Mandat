import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { ReactNode } from 'react';

import { pushPreferencesQueryKey, useUpdatePushPreference, type PushPreferences } from '../pushApi';

const mockPatch = jest.fn();

jest.mock('@/lib/api', () => ({
  api: { PATCH: (...args: unknown[]) => mockPatch(...args) },
  unwrap: async (call: Promise<{ data?: unknown; error?: unknown }>) => {
    const result = await call;
    if (result.error) throw new Error('api error');
    return result.data;
  },
}));

const DEFAULTS: PushPreferences = { boosterReady: true, streak: true, nudges: true, friends: true, events: true, marketing: false };

async function setup() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  client.setQueryData(pushPreferencesQueryKey, DEFAULTS);
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  const hook = await renderHook(() => useUpdatePushPreference(), { wrapper });
  return { client, hook };
}

describe('useUpdatePushPreference', () => {
  it('sends only the changed category and keeps the server answer', async () => {
    mockPatch.mockResolvedValue({ data: { ...DEFAULTS, marketing: true } });
    const { client, hook } = await setup();

    await act(async () => {
      hook.result.current.mutate({ marketing: true });
    });

    await waitFor(() => expect(client.getQueryData<PushPreferences>(pushPreferencesQueryKey)?.marketing).toBe(true));
    expect(mockPatch).toHaveBeenCalledWith('/api/v1/push/preferences', { body: { marketing: true } });
  });

  it('rolls back the optimistic toggle when the server refuses', async () => {
    mockPatch.mockResolvedValue({ error: { code: 'internal_error' } });
    const { client, hook } = await setup();

    await act(async () => {
      hook.result.current.mutate({ streak: false });
    });

    await waitFor(() => expect(hook.result.current.isError).toBe(true));
    expect(client.getQueryData<PushPreferences>(pushPreferencesQueryKey)?.streak).toBe(true);
  });
});
