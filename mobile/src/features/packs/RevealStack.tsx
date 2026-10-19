import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { CardBack, CardReveal, TradingCard } from '@/components/cards';
import { Body, Button3D, Caption } from '@/components/ui';
import { getCard } from '@/data/catalog';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { spacing } from '@/theme';
import { springs } from '@/theme/motion';
import { rarityRank } from '@/theme/rarity';
import type { CardFinish } from '@/types/card';

import { useRevealMemory } from './revealMemory';
import { initialRevealFlow, revealFlowStep, revealOrder, type RevealFlowEvent } from './revealFlow';
import type { DrawnCard } from './types';

/** Face-down cards visible under the top one. */
const PILE_DEPTH = 3;
const FLY_MS = 320;

type RevealStackProps = {
  cards: readonly DrawnCard[];
  cardWidth: number;
  onDone: () => void;
};

type Leaving = { key: string; drawn: DrawnCard; direction: 1 | -1 };

/**
 * TCG Pocket-style reveal: the cards come out of the pack as a face-down stack, rarest last.
 * Tap the top card to flip it, tap (or swipe) again and it flies off, revealing the next one.
 * Nothing waits for an animation: a tap is always handled on the card on top right now.
 */
export function RevealStack({ cards, cardWidth, onDone }: RevealStackProps) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const markSeen = useRevealMemory((state) => state.markSeen);
  const ordered = useMemo(() => revealOrder(cards), [cards]);
  const count = ordered.length;

  // Decided once for the whole pack: a second card of a new rarity is no longer a first time.
  const [firstTimes] = useState(() => {
    const seen = new Set(useRevealMemory.getState().seen);
    return ordered.map(({ rarity }) => {
      const first = !seen.has(rarity);
      seen.add(rarity);
      return first;
    });
  });

  const [flow, setFlow] = useState(() => initialRevealFlow(count));
  const flowRef = useRef(flow);
  const [leaving, setLeaving] = useState<Leaving[]>([]);
  const doneTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (doneTimer.current) clearTimeout(doneTimer.current);
    },
    [],
  );

  const dispatch = useCallback(
    (event: RevealFlowEvent, direction: 1 | -1 = 1) => {
      const current = flowRef.current;
      const { state, effect } = revealFlowStep(current, event, count);
      flowRef.current = state;
      setFlow(state);
      if (effect !== 'dismiss') return;
      const drawn = ordered[current.index];
      if (drawn) setLeaving((list) => [...list, { key: `${current.index}-${drawn.cardId}`, drawn, direction }]);
      haptics.tap();
      playSound('flip');
      if (state.phase === 'summary') {
        doneTimer.current = setTimeout(onDone, reduceMotion ? 0 : FLY_MS * 0.6);
      }
    },
    [count, onDone, ordered, reduceMotion],
  );

  // Stack entrance: the pile slides up out of the torn pack.
  const entrance = useSharedValue(reduceMotion ? 1 : 0);
  useEffect(() => {
    if (!reduceMotion) entrance.set(withSpring(1, springs.bounce));
  }, [entrance, reduceMotion]);
  const entranceStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, entrance.get() * 2),
    transform: [{ translateY: (1 - entrance.get()) * 220 }, { scale: 0.82 + entrance.get() * 0.18 }],
  }));

  const index = flow.index;
  const top = ordered[index];
  const topCard = top ? getCard(top.cardId) : undefined;
  const below = ordered.slice(index + 1, index + 1 + PILE_DEPTH);
  const cardHeight = Math.round(cardWidth * (88 / 63));

  return (
    <View style={styles.root}>
      <Caption align="center">{t('packOpening.progress', { current: Math.min(index + 1, count), total: count })}</Caption>
      <Animated.View style={[styles.stage, entranceStyle]}>
        {/* Pile under the top card, deepest first. */}
        {below
          .map((drawn, depth) => (
            <View
              key={`pile-${index + 1 + depth}`}
              pointerEvents="none"
              style={[
                styles.pile,
                {
                  transform: [
                    { translateY: (depth + 1) * 10 },
                    { rotate: `${(depth % 2 === 0 ? 1 : -1) * (depth + 1) * 1.6}deg` },
                    { scale: 1 - (depth + 1) * 0.035 },
                  ],
                },
              ]}
            >
              <CardBack width={cardWidth} />
            </View>
          ))
          .reverse()}

        {top && flow.phase === 'stack' ? (
          topCard ? (
            <CardReveal
              key={`${index}-${top.cardId}`}
              card={topCard}
              finish={top.finish}
              isNew={top.isNew}
              firstTimeForRarity={firstTimes[index] ?? false}
              // Rare and better cards glow on the back as soon as they reach the top: the suspense.
              hintRarity={rarityRank(top.rarity) >= 2}
              width={cardWidth}
              onRevealStart={() => {
                if (flowRef.current.top === 'hidden') {
                  flowRef.current = { ...flowRef.current, top: 'revealing' };
                  setFlow(flowRef.current);
                }
              }}
              onRevealed={() => {
                markSeen(top.rarity);
                dispatch({ type: 'revealed' });
              }}
              onRevealedTap={(direction) => dispatch({ type: 'tap', skippable: true }, direction)}
              revealedLabel={index === count - 1 ? t('packOpening.seeAll') : t('packOpening.nextCard')}
            />
          ) : (
            // Catalog older than the server's: the card still counts, it just can't be drawn.
            <View style={[styles.unknown, { width: cardWidth, height: cardHeight }]}>
              <Body tone="muted" align="center">
                {t('packOpening.unknownCard')}
              </Body>
              <Button3D
                label={t('packOpening.nextCard')}
                variant="secondary"
                onPress={() => {
                  // Nothing to flip: treat it as face up and move on.
                  flowRef.current = { ...flowRef.current, top: 'revealed' };
                  dispatch({ type: 'tap', skippable: true });
                }}
              />
            </View>
          )
        ) : null}

        {leaving.map((item) => (
          <FlyingCard
            key={item.key}
            drawn={item.drawn}
            width={cardWidth}
            direction={item.direction}
            reduceMotion={reduceMotion}
            onGone={() => setLeaving((list) => list.filter((entry) => entry.key !== item.key))}
          />
        ))}
      </Animated.View>
      <View style={styles.footer}>
        <Caption align="center">
          {flow.top === 'revealed' ? t('packOpening.tapToNext') : t('packOpening.tapToReveal')}
        </Caption>
      </View>
    </View>
  );
}

type FlyingCardProps = {
  drawn: DrawnCard;
  width: number;
  direction: 1 | -1;
  reduceMotion: boolean;
  onGone: () => void;
};

/** The face-up card leaving the stack; purely visual, never touchable. */
function FlyingCard({ drawn, width, direction, reduceMotion, onGone }: FlyingCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const card = getCard(drawn.cardId);
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduceMotion) {
      onGone();
      return;
    }
    progress.set(
      withTiming(1, { duration: FLY_MS, easing: Easing.in(Easing.cubic) }, (finished) => {
        if (finished) scheduleOnRN(onGone);
      }),
    );
  }, [onGone, progress, reduceMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: 1 - progress.get() * 0.4,
    transform: [
      { translateX: direction * progress.get() * screenWidth * 1.1 },
      { translateY: -progress.get() * 60 },
      { rotate: `${direction * progress.get() * 24}deg` },
    ],
  }));

  if (!card) return null;
  return (
    <Animated.View pointerEvents="none" style={[styles.flying, style]}>
      <TradingCard card={card} finish={drawn.finish as CardFinish} width={width} size="hero" interactive={false} gyro={false} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.sm },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pile: { position: 'absolute' },
  flying: { position: 'absolute' },
  unknown: { alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.md },
  footer: { minHeight: 40, justifyContent: 'center', paddingHorizontal: spacing.lg },
});
