import { useReducedMotion } from 'react-native-reanimated';

import { useSettingsStore } from '@/features/settings/store';

/** Effective "reduce motion": the in-app setting overrides the OS one. */
export function useReduceMotion(): boolean {
  const systemReduceMotion = useReducedMotion();
  const preference = useSettingsStore((state) => state.reduceMotion);
  return preference ?? systemReduceMotion;
}
