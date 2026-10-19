import type { WithSpringConfig, WithTimingConfig } from 'react-native-reanimated';

export const springs = {
  press: { damping: 18, stiffness: 420, mass: 0.6 },
  bounce: { damping: 11, stiffness: 260, mass: 0.7 },
  gentle: { damping: 20, stiffness: 160, mass: 1 },
} satisfies Record<string, WithSpringConfig>;

export const timings = {
  fast: { duration: 120 },
  base: { duration: 220 },
  slow: { duration: 360 },
} satisfies Record<string, WithTimingConfig>;

/** Used instead of any animation when reduce motion is on. */
export const instant: WithTimingConfig = { duration: 0 };
