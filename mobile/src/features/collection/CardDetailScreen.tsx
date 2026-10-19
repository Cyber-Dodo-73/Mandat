import { useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { CARD_WIDTHS, GOLD, isFinishAvailable, RarityPips, TradingCard } from '@/components/cards';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import {
  Body,
  Caption,
  EmptyState,
  Heading,
  PressableScale,
  ProgressBar,
  ScreenContainer,
  Card as Surface,
  Text,
} from '@/components/ui';
import { getCard } from '@/data/catalog';
import { portraitCreditFor } from '@/features/credits/credits';
import { useTranslation } from '@/i18n';
import { spacing } from '@/theme';
import { rarityStyles } from '@/theme/rarity';
import { CARD_FINISHES, STAT_KEYS, type Card, type CardFinish } from '@/types/card';

import { useCardText } from './cardText';
import { useOwnedCopies } from './queries';

export function CardDetailScreen() {
  const { id, finish } = useLocalSearchParams<{ id: string; finish?: string }>();
  const { t } = useTranslation();
  const card = id ? getCard(id) : undefined;

  if (!card) {
    return (
      <ScreenContainer edges={['bottom']}>
        <ScreenHeader title={t('card.title')} dismiss="close" />
        <EmptyState icon="albums-outline" message={t('card.notFound')} />
      </ScreenContainer>
    );
  }
  return <CardDetail card={card} finish={parseFinish(card, finish)} />;
}

/** The finish comes from the route (`/card/s1-001?finish=gold`); unknown values fall back to standard. */
function parseFinish(card: Card, value: string | undefined): CardFinish {
  const finish = CARD_FINISHES.find((candidate) => candidate === value) ?? 'standard';
  return isFinishAvailable(card.rarity, finish) ? finish : 'standard';
}

/** Attribution of the portrait, as its license requires; opens the Commons page. */
function PhotoCredit({ cardId }: { cardId: string }) {
  const { t } = useTranslation();
  const credit = portraitCreditFor(cardId);
  if (!credit) return null;
  const label = t('credits.line', {
    artist: credit.artist ?? t('credits.unknownAuthor'),
    license: credit.license ?? t('credits.unknownLicense'),
  });
  const source = credit.sourcePage;
  if (!source) return <Caption align="center" numberOfLines={2}>{label}</Caption>;
  return (
    <PressableScale accessibilityRole="link" accessibilityHint={t('credits.openSource')} onPress={() => void Linking.openURL(source)}>
      <Caption align="center" numberOfLines={2}>
        {label}
      </Caption>
    </PressableScale>
  );
}

function CardDetail({ card, finish }: { card: Card; finish: CardFinish }) {
  const { t } = useTranslation();
  const text = useCardText(card);
  const rarity = rarityStyles[card.rarity];

  return (
    <ScreenContainer edges={['bottom']}>
      <ScreenHeader title={text.name} dismiss="close" />

      <View style={styles.hero}>
        <TradingCard card={card} finish={finish} size="hero" width={CARD_WIDTHS.hero} />
        <Caption align="center">{t('card.dragHint')}</Caption>
        <PhotoCredit cardId={card.id} />
      </View>

      <View style={styles.identity}>
        <View style={styles.rarityRow}>
          <RarityPips rarity={card.rarity} size={9} />
          <Text variant="label" color={rarity.color}>
            {t(`rarity.${card.rarity}`)}
          </Text>
          {finish === 'standard' ? null : (
            <Text variant="label" color={finish === 'gold' ? GOLD.base : undefined}>
              {t(`cards.finish.${finish}`)}
            </Text>
          )}
        </View>
        <Heading>{text.role}</Heading>
        <Caption>{text.lifespan}</Caption>
      </View>

      <Surface>
        <Heading>{t('card.bio')}</Heading>
        <Body>{text.bio}</Body>
      </Surface>

      <Surface>
        <Heading>{t('card.stats')}</Heading>
        {STAT_KEYS.map((key) => (
          <View key={key} style={styles.statRow}>
            <View style={styles.statLabel}>
              <Text variant="label">{t(`cards.stats.${key}`)}</Text>
              <Text variant="label" tone="muted">
                {card.stats[key]}/10
              </Text>
            </View>
            <ProgressBar
              progress={card.stats[key] / 10}
              color={rarity.color}
              height={10}
              accessibilityLabel={`${t(`cards.stats.${key}`)} ${card.stats[key]}/10`}
            />
          </View>
        ))}
      </Surface>

      <Surface>
        <Heading>{t('card.ability')}</Heading>
        <Text variant="bodyStrong" color={rarity.color}>
          {text.abilityName}
        </Text>
        <Body>{text.abilityDescription}</Body>
      </Surface>

      <Surface>
        <Heading>{t('card.copies')}</Heading>
        <OwnedCopies cardId={card.id} />
      </Surface>
    </ScreenContainer>
  );
}

function OwnedCopies({ cardId }: { cardId: string }) {
  const { t } = useTranslation();
  const copies = useOwnedCopies(cardId);
  if (copies.length === 0) return <Caption>{t('card.notOwned')}</Caption>;
  return (
    <>
      {copies.map((copy) => (
        <Body key={copy.finish}>
          {t('card.copiesOfFinish', { count: copy.quantity, finish: t(`cards.finish.${copy.finish}`) })}
        </Body>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  identity: { gap: spacing.xxs },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  statRow: { gap: spacing.xxs },
  statLabel: { flexDirection: 'row', justifyContent: 'space-between' },
});
