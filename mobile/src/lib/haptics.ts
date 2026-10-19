import * as Haptics from 'expo-haptics';

import { useSettingsStore } from '@/features/settings/store';
import type { RevealHaptic } from '@/theme/rarity';

const { ImpactFeedbackStyle: Impact, NotificationFeedbackType: Notification } = Haptics;

type Step = { at: number; run: () => Promise<void> };

const impact = (style: Haptics.ImpactFeedbackStyle) => () => Haptics.impactAsync(style);
const notify = (type: Haptics.NotificationFeedbackType) => () => Haptics.notificationAsync(type);

function isEnabled(): boolean {
  return useSettingsStore.getState().hapticsEnabled;
}

function fire(run: () => Promise<void>): void {
  if (!isEnabled()) return;
  // Haptics are best effort: unsupported devices must never crash the app.
  run().catch(() => undefined);
}

function sequence(steps: readonly Step[]): void {
  if (!isEnabled()) return;
  for (const step of steps) {
    setTimeout(() => fire(step.run), step.at);
  }
}

export const haptics = {
  tap: () => fire(() => Haptics.selectionAsync()),
  toggle: () => fire(() => Haptics.selectionAsync()),
  tearTick: () => fire(impact(Impact.Light)),

  flipCommon: () => fire(impact(Impact.Light)),
  flipUncommon: () => fire(impact(Impact.Light)),
  flipRare: () => fire(impact(Impact.Medium)),
  flipEpic: () =>
    sequence([
      { at: 0, run: impact(Impact.Medium) },
      { at: 140, run: impact(Impact.Heavy) },
    ]),
  flipLegendary: () =>
    sequence([
      { at: 0, run: impact(Impact.Light) },
      { at: 220, run: impact(Impact.Medium) },
      { at: 440, run: impact(Impact.Heavy) },
      { at: 720, run: notify(Notification.Success) },
    ]),
  /** Long, rhythmic pattern reserved for mythic reveals. */
  flipMythic: () =>
    sequence([
      { at: 0, run: impact(Impact.Light) },
      { at: 160, run: impact(Impact.Light) },
      { at: 320, run: impact(Impact.Medium) },
      { at: 480, run: impact(Impact.Medium) },
      { at: 640, run: impact(Impact.Heavy) },
      { at: 900, run: impact(Impact.Rigid) },
      { at: 1050, run: impact(Impact.Rigid) },
      { at: 1200, run: impact(Impact.Heavy) },
      { at: 1500, run: notify(Notification.Success) },
    ]),

  newCard: () => fire(notify(Notification.Success)),
  missionComplete: () => fire(notify(Notification.Success)),
  levelUp: () =>
    sequence([
      { at: 0, run: impact(Impact.Heavy) },
      { at: 180, run: notify(Notification.Success) },
    ]),
  error: () => fire(notify(Notification.Error)),
} as const satisfies Record<string, () => void> & Record<RevealHaptic, () => void>;

export type HapticPattern = keyof typeof haptics;
