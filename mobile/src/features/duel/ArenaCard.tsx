import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { CardBack, CardFlip, cardMetrics, TradingCard } from '@/components/cards';
import { getCard } from '@/data/catalog';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { rarityStyles, useTheme } from '@/theme';
import { instant, springs } from '@/theme/motion';

type ArenaCardProps = {
  cardId: string | null;
  width: number;
  /** Face up once the server resolved the round. */
  revealed: boolean;
  /** Delay before flipping, so both sides do not flip at the exact same frame. */
  flipDelayMs?: number;
  outcome?: 'win' | 'lose' | 'draw' | null;
};

/** A card in the arena: face down while the round resolves, then flipped and judged. */
export function ArenaCard({ cardId, width, revealed, flipDelayMs = 0, outcome }: ArenaCardProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const metrics = cardMetrics('large', width);
  const progress = useSharedValue(revealed ? 1 : 0);
  const pulse = useSharedValue(1);
  const glow = useSharedValue(0);
  const card = cardId ? getCard(cardId) : undefined;

  useEffect(() => {
    const target = revealed ? 1 : 0;
    progress.set(reduceMotion ? withTiming(target, instant) : withDelay(flipDelayMs, withTiming(target, { duration: 420 })));
  }, [flipDelayMs, progress, reduceMotion, revealed]);

  useEffect(() => {
    if (outcome === 'win') {
      glow.set(withTiming(1, reduceMotion ? instant : { duration: 260 }));
      pulse.set(reduceMotion ? 1 : withSequence(withSpring(1.08, springs.bounce), withSpring(1, springs.gentle)));
    } else {
      glow.set(withTiming(0, instant));
      pulse.set(withTiming(outcome === 'lose' ? 0.94 : 1, reduceMotion ? instant : { duration: 260 }));
    }
  }, [glow, outcome, pulse, reduceMotion]);

  const wrapperStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulse.get() }],
    opacity: outcome === 'lose' ? 0.6 : 1,
  }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.get() }));

  if (!card) {
    return <View style={[styles.empty, { width: metrics.width, height: metrics.height, borderRadius: metrics.radius, borderColor: colors.border }]} />;
  }

  return (
    <Animated.View style={wrapperStyle}>
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          { borderRadius: metrics.radius + 6, shadowColor: rarityStyles[card.rarity].color, borderColor: colors.success },
          glowStyle,
        ]}
      />
      <CardFlip
        progress={progress}
        width={metrics.width}
        height={metrics.height}
        back={<CardBack width={metrics.width} />}
        front={<TradingCard card={card} width={metrics.width} size="large" interactive={false} gyro={false} />}
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  empty: { borderWidth: 2, borderStyle: 'dashed' },
  glow: {
    ...StyleSheet.absoluteFill,
    margin: -6,
    borderWidth: 3,
    shadowOpacity: 0.8,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 0 },
  },
});
