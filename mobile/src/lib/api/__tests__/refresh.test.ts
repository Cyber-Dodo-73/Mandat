import { ApiError } from '../errors';
import { refreshAccessToken } from '../refresh';
import { onSessionExpired, tokenStore } from '../tokens';

jest.mock('expo-secure-store', () => {
  const values = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => values.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => void values.set(key, value)),
    deleteItemAsync: jest.fn(async (key: string) => void values.delete(key)),
  };
});

const authResponse = (n: number) => ({
  accessToken: `access-${n}`,
  refreshToken: `refresh-${n}`,
  accessTokenExpiresAt: '2026-10-19T12:00:00Z',
  refreshTokenExpiresAt: '2026-11-19T12:00:00Z',
  tokenType: 'Bearer',
  userId: 'user-1',
  newUser: false,
});

const jsonResponse = (status: number, body: unknown) =>
  ({ ok: status >= 200 && status < 300, status, json: async () => body }) as Response;

describe('refreshAccessToken', () => {
  const fetchMock = jest.fn();

  beforeEach(async () => {
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await tokenStore.save({ accessToken: 'access-0', refreshToken: 'refresh-0' });
  });

  it('sends a single refresh request for concurrent callers', async () => {
    let resolve: (response: Response) => void = () => undefined;
    fetchMock.mockReturnValueOnce(new Promise<Response>((done) => (resolve = done)));

    const calls = [refreshAccessToken(), refreshAccessToken(), refreshAccessToken()];
    resolve(jsonResponse(200, authResponse(1)));

    await expect(Promise.all(calls)).resolves.toEqual(['access-1', 'access-1', 'access-1']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({ refreshToken: 'refresh-0' });
    expect(tokenStore.get()).toEqual({ accessToken: 'access-1', refreshToken: 'refresh-1' });
  });

  it('starts a new request once the previous one settled', async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse(200, authResponse(1)));
    fetchMock.mockResolvedValueOnce(jsonResponse(200, authResponse(2)));

    await refreshAccessToken();
    await expect(refreshAccessToken()).resolves.toBe('access-2');
    expect(JSON.parse(fetchMock.mock.calls[1][1].body)).toEqual({ refreshToken: 'refresh-1' });
  });

  it('ends the session when the server rejects the refresh token', async () => {
    const expired = jest.fn();
    const unsubscribe = onSessionExpired(expired);
    fetchMock.mockResolvedValueOnce(jsonResponse(401, { code: 'invalid_refresh_token' }));

    await expect(refreshAccessToken()).resolves.toBeNull();
    expect(tokenStore.get()).toBeNull();
    expect(expired).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it('keeps the session on a network failure', async () => {
    fetchMock.mockRejectedValue(new TypeError('Network request failed'));

    await expect(refreshAccessToken()).rejects.toMatchObject({ code: 'network' });
    await expect(refreshAccessToken().catch((error: unknown) => error)).resolves.toBeInstanceOf(ApiError);
    expect(tokenStore.get()).toEqual({ accessToken: 'access-0', refreshToken: 'refresh-0' });
  });
});
