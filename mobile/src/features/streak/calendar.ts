import type { StreakDay, StreakDayStatus } from './api';

/** A calendar cell: the server's status for past days and today, `future` after today. */
export type CalendarStatus = StreakDayStatus | 'future';
export type CalendarDay = { date: string; day: number; weekday: number; status: CalendarStatus };

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local dates are handled as UTC midnights so no device timezone can shift them. */
function parse(date: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1));
}

function format(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export function addDays(date: string, days: number): string {
  return format(new Date(parse(date).getTime() + days * DAY_MS));
}

/** 0 = Monday … 6 = Sunday (ISO weeks, like the server). */
export function isoWeekday(date: string): number {
  return (parse(date).getUTCDay() + 6) % 7;
}

function statusOf(date: string, today: string, statuses: ReadonlyMap<string, StreakDayStatus>): CalendarStatus {
  if (date > today) return 'future';
  return statuses.get(date) ?? (date === today ? 'today' : 'none');
}

export function statusMap(days: readonly StreakDay[] | undefined): Map<string, StreakDayStatus> {
  return new Map((days ?? []).map((day) => [day.date, day.status]));
}

function cell(date: string, today: string, statuses: ReadonlyMap<string, StreakDayStatus>): CalendarDay {
  return { date, day: parse(date).getUTCDate(), weekday: isoWeekday(date), status: statusOf(date, today, statuses) };
}

/** Monday to Sunday of the player's current week. */
export function weekStrip(today: string, statuses: ReadonlyMap<string, StreakDayStatus>): CalendarDay[] {
  const monday = addDays(today, -isoWeekday(today));
  return Array.from({ length: 7 }, (_, index) => cell(addDays(monday, index), today, statuses));
}

/** First day (YYYY-MM-01) of the month `offset` months before the one containing `today`. */
export function monthStart(today: string, offset = 0): string {
  const date = parse(today);
  return format(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - offset, 1)));
}

/**
 * The month as weeks of 7 cells, Monday first; `null` pads the first and last weeks.
 */
export function monthGrid(month: string, today: string, statuses: ReadonlyMap<string, StreakDayStatus>): (CalendarDay | null)[][] {
  const first = parse(month);
  const length = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: (CalendarDay | null)[] = Array.from({ length: isoWeekday(month) }, () => null);
  for (let index = 0; index < length; index++) cells.push(cell(addDays(month, index), today, statuses));
  while (cells.length % 7 !== 0) cells.push(null);
  const weeks: (CalendarDay | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) weeks.push(cells.slice(index, index + 7));
  return weeks;
}

/** Days kept (played or frozen) in a list of cells. */
export function keptCount(days: readonly (CalendarDay | null)[]): number {
  return days.filter((day) => day?.status === 'active' || day?.status === 'frozen').length;
}

/** Progress (0–1) from the previous milestone to the next one. */
export function milestoneProgress(current: number, next: number, milestones: readonly number[]): number {
  const previous = Math.max(0, ...milestones.filter((days) => days < next));
  if (next <= previous) return 1;
  return Math.min(1, Math.max(0, (current - previous) / (next - previous)));
}
