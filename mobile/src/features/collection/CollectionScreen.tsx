import { router } from 'expo-router';
import { useMemo } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { TradingCard } from '@/components/cards';
import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { Caption, Card, EmptyState, PressableScale, ProgressBar, ScreenContainer, Title } from '@/components/ui';
import { getCard, seasonSize } from '@/data/catalog';
import { useIsOnline } from '@/hooks/useIsOnline';
import { formatPercent, useLanguage, useTranslation } from '@/i18n';
import { errorMessageKey } from '@/lib/api';
import { spacing, useTheme } from '@/theme';
import type { Card as TradingCardData, CardFinish } from '@/types/card';

import { useCollectionQuery } from './queries';

const COLUMNS = 3;
/** Finishes from the most to the least special: the grid shows the best print owned. */
const FINISH_ORDER: readonly CardFinish[] = ['gold', 'full_art', 'holo', 'standard'];

type OwnedEntry = { card: TradingCardData; finish: CardFinish; copies: number };

export function CollectionScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const online = useIsOnline();
  const { width } = useWindowDimensions();
  const collection = useCollectionQuery();

  const owned = useMemo<OwnedEntry[]>(() => {
    const byCard = new Map<string, OwnedEntry>();
    for (const item of collection.data?.items ?? []) {
      const card = getCard(item.cardId);
      if (!card) continue;
      const current = byCard.get(item.cardId);
      const better = !current || FINISH_ORDER.indexOf(item.finish) < FINISH_ORDER.indexOf(current.finish);
      byCard.set(item.cardId, {
        card,
        finish: better ? item.finish : (current?.finish ?? item.finish),
        copies: (current?.copies ?? 0) + item.quantity,
      });
    }
    return [...byCard.values()].sort((a, b) => a.card.number - b.card.number);
  }, [collection.data]);

  const distinct = collection.data?.distinctCards ?? 0;
  const completion = seasonSize > 0 ? distinct / seasonSize : 0;
  const cardWidth = Math.floor((width - spacing.md * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS);

  return (
    <ScreenContainer>
      <Title>{t('collection.title')}</Title>
      {online ? null : <OfflineNotice />}
      <Card>
        <Caption>{t('collection.progress', { owned: distinct, total: seasonSize })}</Caption>
        <ProgressBar progress={completion} accessibilityLabel={t('collection.subtitle')} />
        <Caption>{formatPercent(completion, language)}</Caption>
      </Card>
      {owned.length > 0 ? (
        <View style={styles.grid}>
          {owned.map((entry) => (
            <PressableScale
              key={entry.card.id}
              accessibilityRole="button"
              onPress={() => router.push({ pathname: '/card/[id]', params: { id: entry.card.id, finish: entry.finish } })}
            >
              <TradingCard card={entry.card} finish={entry.finish} width={cardWidth} size="grid" />
              {entry.copies > 1 ? <Caption align="center">{t('collection.copies', { count: entry.copies })}</Caption> : null}
            </PressableScale>
          ))}
        </View>
      ) : collection.isPending ? (
        <ActivityIndicator color={colors.textMuted} />
      ) : collection.isError ? (
        <EmptyState icon="cloud-offline-outline" message={t(errorMessageKey(collection.error))} />
      ) : (
        <EmptyState icon="albums-outline" message={t('collection.empty')} />
      )}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
