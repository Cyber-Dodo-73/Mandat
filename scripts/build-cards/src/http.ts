import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { PATHS, USER_AGENT } from './config.ts';

const MAX_ATTEMPTS = 6;
/** 429s are expected under load: retry them for longer, honouring Retry-After. */
const MAX_RATE_LIMITED_ATTEMPTS = 30;

/** Minimum delay between two requests to the same namespace (shared by all workers). */
const MIN_INTERVAL_MS: Record<string, number> = { wikidata: 1000, pageviews: 250 };

type Throttle = { nextAt: number; pausedUntil: number };
const throttles = new Map<string, Throttle>();

/** Waits for this namespace's turn; all workers share the same schedule and 429 pause. */
async function acquire(namespace: string): Promise<void> {
  const t = throttles.get(namespace) ?? { nextAt: 0, pausedUntil: 0 };
  throttles.set(namespace, t);
  for (;;) {
    const now = Date.now();
    const at = Math.max(t.nextAt, t.pausedUntil);
    if (at <= now) {
      t.nextAt = now + (MIN_INTERVAL_MS[namespace] ?? 0);
      return;
    }
    await sleep(at - now);
  }
}

function pause(namespace: string, ms: number): void {
  const t = throttles.get(namespace);
  if (t) t.pausedUntil = Math.max(t.pausedUntil, Date.now() + ms);
}

function cacheFile(namespace: string, key: string): string {
  const hash = createHash('sha256').update(key).digest('hex');
  return path.join(PATHS.cache, namespace, hash.slice(0, 2), `${hash}.json`);
}

async function readCache<T>(file: string): Promise<T | undefined> {
  try {
    return JSON.parse(await readFile(file, 'utf8')) as T;
  } catch {
    return undefined;
  }
}

async function writeCache(file: string, value: unknown): Promise<void> {
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, JSON.stringify(value));
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}

/**
 * GETs a JSON resource with retries (429, 5xx, network errors) and a persistent disk cache
 * keyed by URL. `notFoundValue` is returned (and cached) on 404 instead of throwing.
 */
export async function getJson<T>(
  namespace: string,
  url: string,
  init: { accept?: string; notFoundValue?: T } = {},
): Promise<T> {
  const file = cacheFile(namespace, url);
  const cached = await readCache<T>(file);
  if (cached !== undefined) return cached;

  let rateLimited = 0;
  for (let attempt = 1; ; attempt++) {
    let retryAfterMs = 2000 * 2 ** (attempt - 1);
    await acquire(namespace);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: init.accept ?? 'application/json' },
        signal: AbortSignal.timeout(90_000),
      });
      if (res.ok) {
        const body = (await res.json()) as T;
        await writeCache(file, body);
        return body;
      }
      if (res.status === 404 && 'notFoundValue' in init) {
        await writeCache(file, init.notFoundValue);
        return init.notFoundValue as T;
      }
      if (res.status === 429) {
        if (++rateLimited >= MAX_RATE_LIMITED_ATTEMPTS) throw new HttpError(res.status, url);
        const retryAfter = Number(res.headers.get('retry-after'));
        pause(namespace, Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 30_000);
        attempt--; // rate limiting does not count as a failed attempt
        continue;
      }
      if (res.status < 500 || attempt >= MAX_ATTEMPTS) throw new HttpError(res.status, url);
    } catch (error) {
      if (error instanceof HttpError || attempt >= MAX_ATTEMPTS) throw error;
    }
    await sleep(retryAfterMs);
  }
}

/** Runs `worker` over `items` with at most `concurrency` in flight. */
export async function mapConcurrent<T, R>(
  items: readonly T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>,
  onProgress?: (done: number, total: number) => void,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  let done = 0;
  const run = async () => {
    while (next < items.length) {
      const index = next++;
      results[index] = await worker(items[index] as T, index);
      done++;
      onProgress?.(done, items.length);
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, run));
  return results;
}
