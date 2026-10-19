import createClient from 'openapi-fetch';

import { API_URL } from './config';
import type { paths } from './schema';

/**
 * Typed client generated from the API OpenAPI spec. Never call fetch by hand:
 * add endpoints to the API, run `npm run api:gen`, then use this client.
 * The auth interceptor (token refresh) is added in phase 3.
 */
export const api = createClient<paths>({ baseUrl: API_URL });
