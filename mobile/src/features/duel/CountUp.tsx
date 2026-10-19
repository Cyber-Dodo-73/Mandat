import { useEffect, useState } from 'react';

import { Text, type TextProps } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';

type CountUpProps = Omit<TextProps, 'children'> & {
  from: number;
  to: number;
  /** Delay before counting, so it lands after the flip. */
  delayMs?: number;
  durationMs?: number;
};

/**
 * A number counting from `from` to `to` (both given by the server). Mount it once per
 * reveal: it animates on mount and shows the final value right away with reduce motion.
 */
export function CountUp({ from, to, delayMs = 0, durationMs = 600, ...textProps }: CountUpProps) {
  const reduceMotion = useReduceMotion();
  const [value, setValue] = useState(from);

  useEffect(() => {
    if (reduceMotion) return undefined;
    let frame = 0;
    let startAt = 0;
    const timer = setTimeout(() => {
      const step = (now: number) => {
        if (!startAt) startAt = now;
        const t = Math.min(1, (now - startAt) / durationMs);
        const eased = 1 - (1 - t) ** 3;
        setValue(Math.round(from + (to - from) * eased));
        if (t < 1) frame = requestAnimationFrame(step);
      };
      frame = requestAnimationFrame(step);
    }, delayMs);
    return () => {
      clearTimeout(timer);
      cancelAnimationFrame(frame);
    };
  }, [delayMs, durationMs, from, reduceMotion, to]);

  return <Text {...textProps}>{reduceMotion ? to : value}</Text>;
}
