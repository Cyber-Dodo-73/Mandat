import { useEffect, useRef, useState } from 'react';

import { parseInstant } from '@/lib/time';

/**
 * Seconds left until `targetIso` (a server timestamp), refreshed every second.
 * Display only: the server decides when a free pack is actually available.
 * `onElapsed` fires once when the countdown reaches zero (e.g. to refetch the server state).
 */
export function useCountdown(targetIso: string | null, onElapsed?: () => void): number {
  const [now, setNow] = useState(() => Date.now());
  const target = targetIso ? parseInstant(targetIso) : null;
  // Targets seen in the future: only those trigger onElapsed, so a server date already in the
  // past never causes a refetch loop.
  const pending = useRef<number | null>(null);

  useEffect(() => {
    if (target === null) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [target]);

  const secondsLeft = target === null ? 0 : Math.max(0, Math.round((target - now) / 1000));

  useEffect(() => {
    if (target === null) return;
    if (secondsLeft > 0) {
      pending.current = target;
    } else if (pending.current === target) {
      pending.current = null;
      onElapsed?.();
    }
  }, [onElapsed, secondsLeft, target]);

  return secondsLeft;
}
