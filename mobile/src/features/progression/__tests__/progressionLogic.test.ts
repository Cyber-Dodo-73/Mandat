import { allCards } from '@/data/catalog';

import { firstSentence, pickFigureOfTheDay } from '../figureOfTheDay';
import { planNotifications, type NotificationPlanInput } from '../notificationPlan';
import { RETURN_AFTER_MS, shouldShowReturnRecap } from '../returnRecap';
import { dayKey, zonedParts, zonedTimeToEpoch } from '../zonedTime';

const PARIS = 'Europe/Paris';
const at = (iso: string) => Date.parse(iso);

describe('zoned time', () => {
  it('converts a Paris wall-clock time to an instant, across DST', () => {
    // CEST (UTC+2) in October, CET (UTC+1) after the 25 October 2026 switch.
    expect(zonedTimeToEpoch({ year: 2026, month: 10, day: 19, hour: 20, minute: 0 }, PARIS)).toBe(at('2026-10-19T18:00:00Z'));
    expect(zonedTimeToEpoch({ year: 2026, month: 10, day: 26, hour: 20, minute: 0 }, PARIS)).toBe(at('2026-10-26T19:00:00Z'));
  });

  it('gives the calendar day in the player timezone', () => {
    expect(dayKey(at('2026-10-19T23:30:00Z'), PARIS)).toBe('2026-10-20');
    expect(dayKey(at('2026-10-19T23:30:00Z'), 'America/New_York')).toBe('2026-10-19');
    expect(zonedParts(at('2026-10-19T12:00:00Z'), 'Asia/Tokyo').hour).toBe(21);
  });
});

describe('planNotifications', () => {
  const base: NotificationPlanInput = {
    now: at('2026-10-19T10:00:00Z'),
    enabled: true,
    timeZone: PARIS,
    nextFreePackAt: null,
    currentStreak: 4,
    streakActiveToday: false,
  };

  it('plans nothing when notifications are off', () => {
    expect(planNotifications({ ...base, enabled: false, nextFreePackAt: at('2026-10-19T15:00:00Z') })).toEqual([]);
  });

  it('reminds an endangered streak at 20:00 local time', () => {
    expect(planNotifications(base)).toEqual([{ kind: 'streakAtRisk', at: at('2026-10-19T18:00:00Z') }]);
  });

  it('does not remind a streak already kept today, nor a broken one', () => {
    expect(planNotifications({ ...base, streakActiveToday: true })).toEqual([]);
    expect(planNotifications({ ...base, currentStreak: 0 })).toEqual([]);
  });

  it('skips the reminder once the evening is past', () => {
    expect(planNotifications({ ...base, now: at('2026-10-19T19:30:00Z') })).toEqual([]);
  });

  it('keeps one notification per day, the streak reminder first', () => {
    const plan = planNotifications({ ...base, nextFreePackAt: at('2026-10-19T14:00:00Z') });
    expect(plan).toEqual([{ kind: 'streakAtRisk', at: at('2026-10-19T18:00:00Z') }]);
  });

  it('announces the free booster at its server time, on another day', () => {
    const plan = planNotifications({ ...base, streakActiveToday: true, nextFreePackAt: at('2026-10-20T14:00:00Z') });
    expect(plan).toEqual([{ kind: 'packReady', at: at('2026-10-20T14:00:00Z') }]);
  });

  it('moves a night-time booster to 09:00 local time', () => {
    const plan = planNotifications({ ...base, streakActiveToday: true, nextFreePackAt: at('2026-10-20T01:00:00Z') });
    expect(plan).toEqual([{ kind: 'packReady', at: at('2026-10-20T07:00:00Z') }]);
    const late = planNotifications({ ...base, streakActiveToday: true, nextFreePackAt: at('2026-10-20T21:30:00Z') });
    expect(late).toEqual([{ kind: 'packReady', at: at('2026-10-21T07:00:00Z') }]);
  });

  it('ignores booster dates already in the past', () => {
    expect(planNotifications({ ...base, streakActiveToday: true, nextFreePackAt: at('2026-10-19T09:00:00Z') })).toEqual([]);
  });
});

describe('figure of the day', () => {
  it('is stable for a day and never a sensitive card', () => {
    const first = pickFigureOfTheDay(allCards, '2026-10-19');
    expect(pickFigureOfTheDay(allCards, '2026-10-19')).toBe(first);
    for (let day = 1; day <= 365; day += 1) {
      const date = new Date(Date.UTC(2026, 0, day)).toISOString().slice(0, 10);
      expect(pickFigureOfTheDay(allCards, date)?.sensitive).toBe(false);
    }
  });

  it('changes from one day to another', () => {
    const picks = new Set(['2026-10-19', '2026-10-20', '2026-10-21', '2026-10-22'].map((day) => pickFigureOfTheDay(allCards, day)?.id));
    expect(picks.size).toBeGreaterThan(1);
  });

  it('keeps the first real sentence as anecdote', () => {
    expect(firstSentence('Né en 356 av. J.-C. en Macédoine, il conquiert un empire immense. Il meurt jeune.')).toBe(
      'Né en 356 av. J.-C. en Macédoine, il conquiert un empire immense.',
    );
  });
});

describe('return recap', () => {
  it('shows after three days away, not on a first launch', () => {
    const now = at('2026-10-19T10:00:00Z');
    expect(shouldShowReturnRecap(null, now)).toBe(false);
    expect(shouldShowReturnRecap(now - RETURN_AFTER_MS + 1, now)).toBe(false);
    expect(shouldShowReturnRecap(now - RETURN_AFTER_MS, now)).toBe(true);
  });
});
