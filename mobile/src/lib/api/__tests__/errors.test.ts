import { API_ERROR_CODES, ApiError, describeError, errorMessageKey, problemToError, toTransportError, unwrap } from '../errors';
import fr from '../../../i18n/locales/fr.json';

describe('errorMessageKey', () => {
  it('maps every API error code to its own message', () => {
    for (const code of API_ERROR_CODES) {
      expect(errorMessageKey(new ApiError(409, code))).toBe(`errors.${code}`);
      expect(fr.errors).toHaveProperty(code);
    }
  });

  it('falls back to the generic message for unknown codes and foreign errors', () => {
    expect(errorMessageKey(new ApiError(418, 'teapot'))).toBe('errors.generic');
    expect(errorMessageKey(new Error('boom'))).toBe('errors.generic');
  });

  it('uses the network message when the server was not reached', () => {
    expect(errorMessageKey(new ApiError(0, 'network'))).toBe('errors.network');
  });
});

describe('problemToError', () => {
  it('reads the code, detail and field errors of a ProblemDetail', () => {
    const error = problemToError(400, {
      code: 'validation_failed',
      detail: 'Invalid request',
      errors: [{ field: 'nickname', message: 'too short' }, 'junk'],
    });
    expect(error.status).toBe(400);
    expect(error.code).toBe('validation_failed');
    expect(error.message).toBe('Invalid request');
    expect(error.fieldErrors).toEqual([{ field: 'nickname', message: 'too short' }]);
  });

  it('defaults to an internal error when the body is not a ProblemDetail', () => {
    expect(problemToError(502, 'Bad gateway').code).toBe('internal_error');
  });
});

describe('unwrap', () => {
  const response = (status: number) => ({ ok: status < 400, status }) as Response;

  it('returns the data of a successful call', async () => {
    await expect(unwrap(Promise.resolve({ data: { id: 1 }, response: response(200) }))).resolves.toEqual({ id: 1 });
  });

  it('throws the ProblemDetail code of a failed call', async () => {
    await expect(
      unwrap(Promise.resolve({ error: { code: 'nickname_taken' }, response: response(409) })),
    ).rejects.toMatchObject({ status: 409, code: 'nickname_taken' });
  });

  it('turns transport failures into a network error', async () => {
    await expect(unwrap(Promise.reject(new TypeError('Network request failed')))).rejects.toMatchObject({
      code: 'network',
    });
  });
});

describe('transport errors', () => {
  it('reports only real network failures as "no connection"', () => {
    expect(toTransportError(new TypeError('Network request failed')).isNetwork).toBe(true);
    const other = toTransportError(new Error('Cannot read property x of undefined'));
    expect(other.isNetwork).toBe(false);
    expect(errorMessageKey(other)).toBe('errors.generic');
    expect(describeError(other, (key) => key)).toBe('errors.generic (client_error: Cannot read property x of undefined)');
  });
});
