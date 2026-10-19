import { useEffect, useState } from 'react';

/**
 * Seconds left until `targetIso` (a server timestamp), refreshed every second.
 * Display only: the server decides when a free pack is actually available.
 */
export function useCountdown(targetIso: string | null): number {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!targetIso) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [targetIso]);

  if (!targetIso) return 0;
  return Math.max(0, Math.round((Date.parse(targetIso) - now) / 1000));
}
