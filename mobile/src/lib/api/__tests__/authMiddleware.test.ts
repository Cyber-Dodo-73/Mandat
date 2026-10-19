import { authMiddleware } from '../client';
import { refreshAccessToken } from '../refresh';
import { tokenStore } from '../tokens';

jest.mock('../refresh', () => ({ refreshAccessToken: jest.fn() }));
jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(async () => null),
  setItemAsync: jest.fn(async () => undefined),
  deleteItemAsync: jest.fn(async () => undefined),
}));

type Params = Parameters<NonNullable<typeof authMiddleware.onRequest>>[0];

const refreshMock = refreshAccessToken as jest.MockedFunction<typeof refreshAccessToken>;

function params(request: Request, schemaPath: string): Params {
  return { request, schemaPath, id: 'test', options: {} } as unknown as Params;
}

describe('authMiddleware', () => {
  const fetchMock = jest.fn();

  beforeEach(async () => {
    refreshMock.mockReset();
    fetchMock.mockReset();
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await tokenStore.save({ accessToken: 'access-0', refreshToken: 'refresh-0' });
  });

  async function send(path: string) {
    const request = new Request(`https://api.test${path}`);
    const prepared = (await authMiddleware.onRequest?.(params(request, path))) as Request;
    return prepared;
  }

  it('adds the bearer token except on auth endpoints', async () => {
    expect((await send('/api/v1/packs')).headers.get('Authorization')).toBe('Bearer access-0');
    expect((await send('/api/v1/auth/login')).headers.get('Authorization')).toBeNull();
  });

  it('refreshes once and replays the request with the new token after a 401', async () => {
    refreshMock.mockResolvedValue('access-1');
    fetchMock.mockResolvedValue(new Response('{}', { status: 200 }));
    const request = await send('/api/v1/packs');

    const response = await authMiddleware.onResponse?.({
      ...params(request, '/api/v1/packs'),
      response: new Response(null, { status: 401 }),
    });

    expect(refreshMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, { headers: Record<string, string> }];
    expect(init.headers.authorization).toBe('Bearer access-1');
    expect((response as Response).status).toBe(200);
  });

  it('returns the 401 when the session cannot be refreshed', async () => {
    refreshMock.mockResolvedValue(null);
    const request = await send('/api/v1/packs');
    const unauthorized = new Response(null, { status: 401 });

    const response = await authMiddleware.onResponse?.({ ...params(request, '/api/v1/packs'), response: unauthorized });

    expect(response).toBe(unauthorized);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
