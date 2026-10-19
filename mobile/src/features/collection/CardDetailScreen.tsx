import { useLocalSearchParams } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

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
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { portraitCreditFor } from '@/features/credits/credits';
import { useTranslation } from '@/i18n';
import { spacing } from '@/theme';
import { rarityStyles } from '@/theme/rarity';
import { CARD_FINISHES, STAT_KEYS, type Card, type CardFinish } from '@/types/card';

import { CardHistory } from './CardHistory';
import { useCardText } from './cardText';
import { CollectionActions } from './CollectionActions';

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
  const reduceMotion = useReduceMotion();
  const text = useCardText(card);
  const rarity = rarityStyles[card.rarity];

  return (
    <ScreenContainer edges={['bottom']}>
      <ScreenHeader title={t('card.title')} dismiss="close" />

      <View style={styles.hero}>
        {/* Opening from the binder: the card zooms in from the grid size. */}
        <Animated.View entering={reduceMotion ? undefined : FadeInDown.springify().damping(16).stiffness(180)}>
          <TradingCard card={card} finish={finish} size="hero" width={CARD_WIDTHS.hero} />
        </Animated.View>
        <Caption align="center">{t('card.dragHint')}</Caption>
      </View>

      <View style={styles.identity}>
        <Text variant="title">{text.name}</Text>
        <View style={styles.rarityRow}>
          <View style={[styles.chip, { backgroundColor: `${rarity.color}26`, borderColor: rarity.color }]}>
            <RarityPips rarity={card.rarity} size={8} />
            <Text variant="caption" color={rarity.color}>
              {t(`rarity.${card.rarity}`)}
            </Text>
          </View>
          {finish === 'standard' ? null : (
            <View style={[styles.chip, { borderColor: finish === 'gold' ? GOLD.base : rarity.color }]}>
              <Text variant="caption" color={finish === 'gold' ? GOLD.base : undefined}>
                {t(`cards.finish.${finish}`)}
              </Text>
            </View>
          )}
        </View>
        <Text variant="bodyStrong">{text.role}</Text>
        <Caption>{text.lifespan}</Caption>
      </View>

      <CardHistory cardId={card.id} sober={card.sensitive} />

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

      <CollectionActions card={card} />
      <PhotoCredit cardId={card.id} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  identity: { gap: spacing.xs },
  rarityRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap' },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, height: 28, paddingHorizontal: spacing.sm, borderRadius: 14, borderWidth: 1.5 },
  statRow: { gap: spacing.xxs },
  statLabel: { flexDirection: 'row', justifyContent: 'space-between' },
});
