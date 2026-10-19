import { registerPushToken, unregisterPushToken } from '../pushApi';
import { needsRegistration, REFRESH_INTERVAL_MS, usePushStore } from '../pushStore';
import { pathFromNotificationData } from '../routing';

const mockPost = jest.fn();
const mockDelete = jest.fn();

jest.mock('@/lib/api', () => ({
  api: { POST: (...args: unknown[]) => mockPost(...args), DELETE: (...args: unknown[]) => mockDelete(...args) },
  unwrap: async (call: Promise<{ data?: unknown; error?: unknown }>) => {
    const result = await call;
    if (result.error) throw new Error('api error');
    return result.data;
  },
}));

const TOKEN = 'ExponentPushToken[abcdefghijklmnop]';

beforeEach(() => {
  mockPost.mockReset().mockResolvedValue({ data: undefined });
  mockDelete.mockReset().mockResolvedValue({ data: undefined });
  usePushStore.getState().clearRegistered();
});

describe('pathFromNotificationData', () => {
  it('opens the path carried by server pushes', () => {
    expect(pathFromNotificationData({ path: '/friends', category: 'friends' })).toBe('/friends');
    expect(pathFromNotificationData({ path: '/' })).toBe('/');
  });

  it('maps local reminders to their screen', () => {
    expect(pathFromNotificationData({ kind: 'packReady' })).toBe('/');
    expect(pathFromNotificationData({ kind: 'streakAtRisk' })).toBe('/streak');
  });

  it('ignores external links and unknown payloads', () => {
    expect(pathFromNotificationData({ path: 'https://evil.example' })).toBeNull();
    expect(pathFromNotificationData({ path: '//evil.example' })).toBeNull();
    expect(pathFromNotificationData({ kind: 'nope' })).toBeNull();
    expect(pathFromNotificationData(null)).toBeNull();
  });
});

describe('needsRegistration', () => {
  it('registers a new or changed token, and refreshes a stale one', () => {
    expect(needsRegistration({ registeredToken: null, registeredAt: null }, TOKEN, 1000)).toBe(true);
    expect(needsRegistration({ registeredToken: 'other', registeredAt: 1000 }, TOKEN, 2000)).toBe(true);
    expect(needsRegistration({ registeredToken: TOKEN, registeredAt: 1000 }, TOKEN, 2000)).toBe(false);
    expect(needsRegistration({ registeredToken: TOKEN, registeredAt: 1000 }, TOKEN, 1000 + REFRESH_INTERVAL_MS + 1)).toBe(true);
  });
});

describe('push token registration', () => {
  it('sends the token once, with platform and language', async () => {
    await expect(registerPushToken(TOKEN, 'en', 1000)).resolves.toBe(true);
    await registerPushToken(TOKEN, 'en', 2000);

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0]?.[0]).toBe('/api/v1/push/devices');
    expect(mockPost.mock.calls[0]?.[1]).toEqual({ body: { token: TOKEN, platform: 'ios', locale: 'en' } });
    expect(usePushStore.getState().registeredToken).toBe(TOKEN);
  });

  it('keeps the local fallback when the server refuses the token', async () => {
    mockPost.mockResolvedValue({ error: { code: 'validation_failed' } });
    await expect(registerPushToken(TOKEN, 'fr', 1000)).resolves.toBe(false);
    expect(usePushStore.getState().registeredToken).toBeNull();
  });

  it('unregisters the device on sign out, even when offline', async () => {
    await registerPushToken(TOKEN, 'fr', 1000);
    mockDelete.mockRejectedValue(new TypeError('Network request failed'));

    await unregisterPushToken();

    expect(mockDelete).toHaveBeenCalledWith('/api/v1/push/devices/{token}', { params: { path: { token: TOKEN } } });
    expect(usePushStore.getState().registeredToken).toBeNull();
  });

  it('does nothing to unregister when no token was registered', async () => {
    await unregisterPushToken();
    expect(mockDelete).not.toHaveBeenCalled();
  });
});
