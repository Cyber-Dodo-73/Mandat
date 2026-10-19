import { storage } from '@/lib/storage';

const LAST_ACTIVE_KEY = 'progression.lastActiveAt';
const LAST_SEEN_LEVEL_KEY = 'progression.lastSeenLevel';
export const RETURN_AFTER_MS = 3 * 24 * 60 * 60 * 1000;

/** The "welcome back" recap shows when the previous session is at least three days old. */
export function shouldShowReturnRecap(lastActiveAt: number | null, now: number): boolean {
  return lastActiveAt !== null && now - lastActiveAt >= RETURN_AFTER_MS;
}

export function readLastActiveAt(): number | null {
  const raw = storage.getItem(LAST_ACTIVE_KEY);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isFinite(value) ? value : null;
}

export function writeLastActiveAt(at: number): void {
  storage.setItem(LAST_ACTIVE_KEY, String(at));
}

/** Last level the player saw celebrated on this device (null on first launch). */
export function readLastSeenLevel(): number | null {
  const raw = storage.getItem(LAST_SEEN_LEVEL_KEY);
  const value = raw === null ? Number.NaN : Number(raw);
  return Number.isInteger(value) ? value : null;
}

export function writeLastSeenLevel(level: number): void {
  storage.setItem(LAST_SEEN_LEVEL_KEY, String(level));
}
