import { useEffect, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  type SharedValue,
} from 'react-native-reanimated';

import { Text } from '@/components/ui';
import { APP_NAME } from '@/constants/app';
import type { DrawnCard } from '@/features/packs/types';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { fontFamilies, radius, rarityStyles, useTheme } from '@/theme';
import { springs } from '@/theme/motion';

/** Standard trading card proportions (63 × 88 mm). */
export const CARD_RATIO = 88 / 63;

const STAGGER_MS = 90;

/**
 * Integration point for the cards module: render one face-down (or revealed) card
 * of the fan. `isLast` is slot 5, whose back hints the rarity with a glow.
 */
export type CardSlotRenderer = (args: { card: DrawnCard; index: number; isLast: boolean; width: number }) => ReactNode;

type CardFanStageProps = {
  cards: readonly DrawnCard[];
  cardWidth: number;
  /** Defaults to a placeholder back until `CardBack` / `TradingCard` plug in here. */
  renderCard?: CardSlotRenderer;
};

/** The five cards leave the opened pack and spread into a fan, face down. */
export function CardFanStage({ cards, cardWidth, renderCard = renderPlaceholderBack }: CardFanStageProps) {
  const cardHeight = cardWidth * CARD_RATIO;
  const stageHeight = cardHeight * 1.35;
  return (
    <View style={[styles.stage, { height: stageHeight }]}>
      {cards.map((card, index) => (
        <FanSlot
          key={`${card.cardId}-${index}`}
          index={index}
          count={cards.length}
          cardWidth={cardWidth}
          top={(stageHeight - cardHeight) / 2}
        >
          {renderCard({ card, index, isLast: index === cards.length - 1, width: cardWidth })}
        </FanSlot>
      ))}
    </View>
  );
}

type FanSlotProps = { index: number; count: number; cardWidth: number; top: number; children: ReactNode };

function FanSlot({ index, count, cardWidth, top, children }: FanSlotProps) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(reduceMotion ? 1 : 0);

  useEffect(() => {
    progress.set(reduceMotion ? 1 : withDelay(index * STAGGER_MS, withSpring(1, springs.bounce)));
  }, [index, progress, reduceMotion]);

  const style = useFanStyle(progress, index - (count - 1) / 2, cardWidth);
  return <Animated.View style={[styles.slot, { top, width: cardWidth, marginLeft: -cardWidth / 2 }, style]}>{children}</Animated.View>;
}

function useFanStyle(progress: SharedValue<number>, offset: number, cardWidth: number) {
  return useAnimatedStyle(() => {
    const p = progress.get();
    return {
      opacity: Math.min(1, p * 2),
      transform: [
        { translateX: offset * cardWidth * 0.42 * p },
        { translateY: (1 - p) * 180 + Math.abs(offset) * 12 * p },
        { rotate: `${offset * 7 * p}deg` },
        { scale: 0.55 + 0.45 * p },
      ],
    };
  });
}

function renderPlaceholderBack({ card, isLast, width }: Parameters<CardSlotRenderer>[0]) {
  return <PlaceholderBack hintRarity={isLast ? card.rarity : null} width={width} />;
}

function PlaceholderBack({ hintRarity, width }: { hintRarity: DrawnCard['rarity'] | null; width: number }) {
  const { colors } = useTheme();
  const hint = hintRarity ? rarityStyles[hintRarity] : null;
  return (
    <View
      style={[
        styles.back,
        {
          width,
          height: width * CARD_RATIO,
          backgroundColor: colors.surfaceRaised,
          borderColor: hint?.color ?? colors.border,
          shadowColor: hint?.glow.color ?? colors.shadow,
          shadowOpacity: hint ? hint.glow.opacity : 0.25,
          shadowRadius: hint ? hint.glow.radius : 8,
        },
      ]}
    >
      <Text allowFontScaling={false} style={[styles.monogram, { color: colors.textMuted }]}>
        {APP_NAME.charAt(0)}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { width: '100%' },
  slot: { position: 'absolute', left: '50%' },
  back: {
    borderRadius: radius / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 0 },
  },
  monogram: { fontFamily: fontFamilies.displayHeavy, fontSize: 34 },
});
