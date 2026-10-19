import { APP_SCHEME } from '@/constants/app';

/** Server format: 8 characters, no I, O, 0 or 1 (they read alike). */
export const FRIEND_CODE_PATTERN = /^[A-HJ-NP-Z2-9]{8}$/;

/** Uppercases and drops spaces and dashes typed or pasted by players ("abcd-2345" → "ABCD2345"). */
export function normalizeFriendCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '');
}

export function isFriendCode(input: string): boolean {
  return FRIEND_CODE_PATTERN.test(normalizeFriendCode(input));
}

/**
 * Extracts a friend code from a deep link (`mandat://friend/ABCD2345`, the dev build scheme,
 * or a path `/friend/ABCD2345`) or from a raw code. Returns null when nothing valid is found.
 */
export function parseFriendLink(input: string): string | null {
  const trimmed = input.trim();
  const link = /^(?:[a-z][a-z0-9+.-]*:\/\/)?\/?friend\/([^/?#]+)/i.exec(trimmed);
  const candidate = normalizeFriendCode(decodeURIComponent(link?.[1] ?? trimmed));
  return FRIEND_CODE_PATTERN.test(candidate) ? candidate : null;
}

/** Link shared with other players; opens the app on the add-friend screen. */
export function friendLink(code: string): string {
  return `${APP_SCHEME}://friend/${code}`;
}
