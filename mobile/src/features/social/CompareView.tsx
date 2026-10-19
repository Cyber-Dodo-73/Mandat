import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { TradingCard } from '@/components/cards';
import { Body, Button3D, Caption, Heading, PressableScale } from '@/components/ui';
import { getCard } from '@/data/catalog';
import { useCompareQuery } from '@/features/profile/queries';
import { byBestFinish } from '@/features/profile/showcase';
import { useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { spacing } from '@/theme';
import type { CardFinish } from '@/types/card';

const COLUMNS = 5;
const PREVIEW = 20;

type Entry = { cardId: string; finishes: readonly CardFinish[] };

/** "They have and you don't" / "You have and they don't", with the cards in common. */
export function CompareView({ friendCode, nickname }: { friendCode: string; nickname: string }) {
  const { t } = useTranslation();
  const compare = useCompareQuery(friendCode, true);

  if (!compare.data) {
    return compare.isError ? <Body tone="muted">{describeError(compare.error, t)}</Body> : <Caption>{t('common.loading')}</Caption>;
  }
  const data = compare.data;
  return (
    <View style={styles.root}>
      <Caption>{t('social.compare.common', { count: data.commonCards })}</Caption>
      <CardStrip title={t('social.compare.theyHave', { nickname, count: data.theyHaveYouDont.length })} entries={data.theyHaveYouDont} />
      <CardStrip title={t('social.compare.youHave', { nickname, count: data.youHaveTheyDont.length })} entries={data.youHaveTheyDont} />
    </View>
  );
}

function CardStrip({ title, entries }: { title: string; entries: readonly Entry[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { width } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const cell = Math.floor((width - spacing.md * 2 - spacing.xs * (COLUMNS - 1)) / COLUMNS);
  const shown = expanded ? entries : entries.slice(0, PREVIEW);

  return (
    <View style={styles.strip}>
      <Heading>{title}</Heading>
      {entries.length === 0 ? <Caption>{t('social.compare.nothing')}</Caption> : null}
      <View style={styles.grid}>
        {shown.map((entry) => {
          const card = getCard(entry.cardId);
          if (!card) return null;
          const finish = [...entry.finishes].map((value) => ({ finish: value })).sort(byBestFinish)[0]?.finish ?? 'standard';
          return (
            <PressableScale
              key={entry.cardId}
              accessibilityRole="button"
              accessibilityLabel={card.name[language]}
              onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id, finish } })}
            >
              <TradingCard card={card} finish={finish} size="thumb" width={cell} interactive={false} gyro={false} />
            </PressableScale>
          );
        })}
      </View>
      {entries.length > PREVIEW ? (
        <Button3D
          label={expanded ? t('social.compare.showLess') : t('social.compare.showAll', { count: entries.length })}
          variant="ghost"
          size="sm"
          onPress={() => setExpanded((value) => !value)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.lg },
  strip: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
