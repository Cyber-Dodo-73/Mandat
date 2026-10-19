import { router } from 'expo-router';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { TradingCard } from '@/components/cards';
import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { Badge, Button3D, Caption, Heading } from '@/components/ui';
import { getCard } from '@/data/catalog';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useTranslation } from '@/i18n';
import { spacing, useTheme } from '@/theme';

import type { PackOpenResult } from './types';

const COLUMNS = 3;

type PackRecapProps = { result: PackOpenResult; onOpenAnother: () => void };

/** The five pulls side by side, the Influence earned on duplicates, and what's next. */
export function PackRecap({ result, onOpenAnother }: PackRecapProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const online = useIsOnline();
  const { width } = useWindowDimensions();
  const cardWidth = Math.floor((width - spacing.md * 2 - spacing.sm * (COLUMNS - 1)) / COLUMNS);
  const packsLeft = result.freePacks.stock + result.bonusPacks;
  const newCount = result.cards.filter((card) => card.isNew).length;

  return (
    <View style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Heading align="center">{t('packOpening.recapTitle', { count: newCount })}</Heading>
        <View style={styles.grid}>
          {result.cards.map((drawn, index) => {
            const card = getCard(drawn.cardId);
            return (
              <View key={`${drawn.cardId}-${index}`} style={{ width: cardWidth }}>
                {card ? <TradingCard card={card} finish={drawn.finish} width={cardWidth} size="grid" /> : null}
                {drawn.isNew ? (
                  <View style={styles.badge}>
                    <Badge label={t('cards.newBadge')} color={colors.accent} textColor={colors.onAccent} />
                  </View>
                ) : drawn.influenceGained > 0 ? (
                  <Caption align="center">{t('packOpening.duplicate', { amount: drawn.influenceGained })}</Caption>
                ) : null}
              </View>
            );
          })}
        </View>
        {result.influenceGained > 0 ? (
          <Caption align="center">{t('packOpening.influence', { amount: result.influenceGained })}</Caption>
        ) : null}
      </ScrollView>
      <View style={styles.footer}>
        {packsLeft > 0 && !online ? <OfflineNotice message={t('offline.packOpening')} /> : null}
        {packsLeft > 0 ? (
          <Button3D
            label={t('packOpening.openAnother', { count: packsLeft })}
            icon="flash"
            size="lg"
            fullWidth
            disabled={!online}
            onPress={onOpenAnother}
          />
        ) : null}
        <Button3D
          label={t('packOpening.done')}
          variant={packsLeft > 0 ? 'secondary' : 'primary'}
          size="lg"
          fullWidth
          onPress={() => router.back()}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.md },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.sm },
  badge: { alignItems: 'center', marginTop: -spacing.sm },
  footer: { paddingHorizontal: spacing.lg, gap: spacing.sm },
});
