import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';

/** Network state as React Query sees it (fed by NetInfo in lib/api/queryClient). */
export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (onChange) => onlineManager.subscribe(onChange),
    () => onlineManager.isOnline(),
  );
}
