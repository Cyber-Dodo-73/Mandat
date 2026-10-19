/**
 * Epoch milliseconds of a server timestamp (Java Instant, e.g. "2026-10-19T12:28:34.364285043Z").
 * Fractional seconds are cut to milliseconds first: not every JS engine parses more than three
 * digits. Returns null when the value can't be parsed.
 */
export function parseInstant(iso: string): number | null {
  const millis = Date.parse(iso.replace(/(\.\d{3})\d+/, '$1'));
  return Number.isNaN(millis) ? null : millis;
}
