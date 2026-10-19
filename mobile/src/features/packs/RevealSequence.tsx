import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { CardBack, CardReveal } from '@/components/cards';
import { Body, Button3D, Caption } from '@/components/ui';
import { getCard } from '@/data/catalog';
import { useTranslation } from '@/i18n';
import { spacing } from '@/theme';

import { useRevealMemory } from './revealMemory';
import type { DrawnCard } from './types';

type RevealSequenceProps = {
  cards: readonly DrawnCard[];
  cardWidth: number;
  onDone: () => void;
};

/**
 * The five cards are revealed one at a time, slot 5 last. The first pull of a rarity plays
 * its full sequence (unskippable); afterwards a tap skips the long animations.
 */
export function RevealSequence({ cards, cardWidth, onDone }: RevealSequenceProps) {
  const { t } = useTranslation();
  const markSeen = useRevealMemory((state) => state.markSeen);
  // Decided once for the whole pack: a second card of a new rarity is no longer a first time.
  const [firstTimes] = useState(() => {
    const seen = new Set(useRevealMemory.getState().seen);
    return cards.map(({ rarity }) => {
      const first = !seen.has(rarity);
      seen.add(rarity);
      return first;
    });
  });
  const [index, setIndex] = useState(0);
  const [revealed, setRevealed] = useState(false);

  const drawn = cards[index];
  const card = drawn ? getCard(drawn.cardId) : undefined;
  const isLast = index === cards.length - 1;
  const remaining = cards.length - index - 1;

  const next = () => {
    if (isLast) {
      onDone();
      return;
    }
    setRevealed(false);
    setIndex((value) => value + 1);
  };

  if (!drawn) return null;

  return (
    <View style={styles.root}>
      <Caption align="center">{t('packOpening.progress', { current: index + 1, total: cards.length })}</Caption>
      <View style={styles.stage}>
        {remaining > 0 ? (
          <View style={[styles.pile, { transform: [{ translateY: 14 }, { scale: 0.94 }] }]} pointerEvents="none">
            <CardBack width={cardWidth} />
          </View>
        ) : null}
        {card ? (
          <CardReveal
            key={`${drawn.cardId}-${index}`}
            card={card}
            finish={drawn.finish}
            isNew={drawn.isNew}
            firstTimeForRarity={firstTimes[index] ?? false}
            hintRarity={isLast}
            width={cardWidth}
            onRevealed={() => {
              markSeen(drawn.rarity);
              setRevealed(true);
            }}
          />
        ) : (
          // Catalog older than the server's: the card still counts, it just can't be drawn.
          <Body tone="muted" align="center">
            {t('packOpening.unknownCard')}
          </Body>
        )}
      </View>
      <View style={styles.footer}>
        {revealed || !card ? (
          <Button3D
            label={isLast ? t('packOpening.seeAll') : t('packOpening.next', { count: remaining })}
            size="lg"
            fullWidth
            onPress={next}
          />
        ) : (
          <Caption align="center">{t('cards.revealHint')}</Caption>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, gap: spacing.sm },
  stage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  pile: { position: 'absolute', opacity: 0.6 },
  footer: { minHeight: 64, justifyContent: 'center', paddingHorizontal: spacing.lg },
});
