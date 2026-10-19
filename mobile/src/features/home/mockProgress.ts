/**
 * TODO(phase 7): replace with the progression block of `GET /me`.
 * Fixed sample values for the hub top bar; nothing is computed on the client.
 */
export type HubProgress = {
  level: number;
  xp: number;
  xpForNextLevel: number;
  streakDays: number;
  influence: number;
};

export const MOCK_PROGRESS: HubProgress = {
  level: 1,
  xp: 35,
  xpForNextLevel: 100,
  streakDays: 0,
  influence: 0,
};
