/**
 * Calendar helpers in an IANA timezone (the player's, sent by the server), without a date
 * library: Intl gives the wall-clock parts of an instant, and we invert it for scheduling.
 */
export type ZonedParts = { year: number; month: number; day: number; hour: number; minute: number };

const formatters = new Map<string, Intl.DateTimeFormat>();

function formatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = formatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    formatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock date and time of `epochMs` in `timeZone`. Unknown zones fall back to UTC. */
export function zonedParts(epochMs: number, timeZone: string): ZonedParts {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatterFor(timeZone).formatToParts(new Date(epochMs));
  } catch {
    parts = formatterFor('UTC').formatToParts(new Date(epochMs));
  }
  const value = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  return { year: value('year'), month: value('month'), day: value('day'), hour: value('hour') % 24, minute: value('minute') };
}

/** "2026-10-19": the calendar day of `epochMs` in `timeZone`. */
export function dayKey(epochMs: number, timeZone: string): string {
  const { year, month, day } = zonedParts(epochMs, timeZone);
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** Epoch of the given wall-clock time in `timeZone` (DST-aware: the offset is re-checked once). */
export function zonedTimeToEpoch(parts: ZonedParts, timeZone: string): number {
  const asUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
  const offsetAt = (epoch: number) => {
    const local = zonedParts(epoch, timeZone);
    return Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - epoch;
  };
  const first = asUtc - offsetAt(asUtc);
  return asUtc - offsetAt(first);
}

/** The same wall-clock time `days` calendar days later, in `timeZone`. */
export function addZonedDays(parts: ZonedParts, days: number): ZonedParts {
  const shifted = new Date(Date.UTC(parts.year, parts.month - 1, parts.day + days));
  return { ...parts, year: shifted.getUTCFullYear(), month: shifted.getUTCMonth() + 1, day: shifted.getUTCDate() };
}
