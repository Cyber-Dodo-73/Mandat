import { asGlobalResponse, plainFetch } from '../client';

describe('plainFetch', () => {
  it('calls fetch with a plain url and init instead of a Request', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    const request = new Request('https://api.test/api/v1/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Accept-Language': 'fr' },
      body: JSON.stringify({ email: 'a@b.c' }),
    });
    await plainFetch(request);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit & { headers: Record<string, string> }];
    expect(url).toBe('https://api.test/api/v1/auth/register');
    expect(init.method).toBe('POST');
    expect(init.body).toBe('{"email":"a@b.c"}');
    expect(init.headers['content-type']).toBe('application/json');
    expect(init.headers['accept-language']).toBe('fr');
  });

  it('sends no body for GET', async () => {
    const fetchMock = jest.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    await plainFetch(new Request('https://api.test/api/v1/me'));
    expect((fetchMock.mock.calls[0] as [string, RequestInit])[1].body).toBeUndefined();
  });
});

describe('asGlobalResponse', () => {
  it('rebuilds a global Response from a foreign Response-like object', async () => {
    const foreign = {
      status: 201,
      statusText: 'Created',
      headers: new Headers({ 'content-type': 'application/json' }),
      text: async () => '{"ok":true}',
    } as unknown as Response;
    const response = await asGlobalResponse(foreign);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ ok: true });
  });

  it('keeps 204 responses bodiless', async () => {
    const foreign = { status: 204, statusText: '', headers: new Headers(), text: async () => '' } as unknown as Response;
    const response = await asGlobalResponse(foreign);
    expect(response.status).toBe(204);
  });
});

describe('api client with a native fetch returning a foreign Response class (iOS / expo fetch)', () => {
  it('resolves the call instead of failing the middleware instanceof check', async () => {
    class ForeignResponse {
      status = 201;
      statusText = 'Created';
      ok = true;
      headers = new Headers({ 'content-type': 'application/json' });
      async text() {
        return '{"accessToken":"a"}';
      }
      async json() {
        return { accessToken: 'a' };
      }
      clone() {
        return this;
      }
    }
    globalThis.fetch = jest.fn().mockResolvedValue(new ForeignResponse()) as unknown as typeof fetch;
    const { api } = jest.requireActual<typeof import('../client')>('../client');
    const result = await api.POST('/api/v1/auth/login', { body: { email: 'a@b.c', password: 'secret123' } });
    expect(result.error).toBeUndefined();
    expect(result.response.status).toBe(201);
  });
});
