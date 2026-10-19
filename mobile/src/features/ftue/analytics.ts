import type { FtueStepId } from './steps';

export type FtueAnalyticsEvent =
  | { name: 'ftue_started' }
  | { name: 'ftue_step_viewed'; step: FtueStepId }
  | { name: 'ftue_step_completed'; step: FtueStepId }
  | { name: 'ftue_step_skipped'; step: FtueStepId; reason: 'player' | 'offline' | 'unavailable' }
  | { name: 'ftue_skipped_all'; step: FtueStepId }
  | { name: 'ftue_completed' }
  | { name: 'ftue_epic_celebrated' };

export type FtueAnalytics = { track: (event: FtueAnalyticsEvent) => void };

/** No analytics backend yet: plug one in with setFtueAnalytics (funnel per step). */
let analytics: FtueAnalytics = { track: () => undefined };

export function setFtueAnalytics(next: FtueAnalytics): void {
  analytics = next;
}

export function trackFtue(event: FtueAnalyticsEvent): void {
  try {
    analytics.track(event);
  } catch {
    // Analytics must never break the tour.
  }
}
