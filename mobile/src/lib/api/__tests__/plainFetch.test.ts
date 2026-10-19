import { plainFetch } from '../client';

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
