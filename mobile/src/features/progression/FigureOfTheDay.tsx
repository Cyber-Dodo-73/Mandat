import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { TradingCard } from '@/components/cards/TradingCard';
import { Caption, Icon, PressableScale, Text } from '@/components/ui';
import { allCards } from '@/data/catalog';
import { localize } from '@/features/collection/cardText';
import { useLanguage, useTranslation } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

import { firstSentence, pickFigureOfTheDay } from './figureOfTheDay';
import { dayKey } from './zonedTime';

/** Compact "figure of the day" strip under the top bar: the booster hub stays the focus. */
export function FigureOfTheDay({ timeZone }: { timeZone: string | undefined }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const zone = timeZone ?? Intl.DateTimeFormat().resolvedOptions().timeZone;
  const today = useToday(zone);
  const card = useMemo(() => pickFigureOfTheDay(allCards, today), [today]);
  if (!card) return null;

  const name = localize(card.name, language);
  const anecdote = firstSentence(localize(card.bio, language));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('home.figureOfTheDay.a11y', { name, anecdote })}
      onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id } })}
      style={[styles.strip, { backgroundColor: colors.surface, borderColor: colors.border }]}
    >
      <View pointerEvents="none">
        <TradingCard card={card} size="thumb" width={44} />
      </View>
      <View style={styles.texts}>
        <Caption tone="accent" style={styles.kicker}>
          {t('home.figureOfTheDay.title')}
        </Caption>
        <Text variant="label" numberOfLines={1}>
          {name}
        </Text>
        <Caption numberOfLines={2}>{anecdote}</Caption>
      </View>
      <Icon name="chevron-forward" size={18} tone="textMuted" />
    </PressableScale>
  );
}

/** Today's date key in `timeZone`, refreshed when the app comes back to the foreground. */
function useToday(timeZone: string): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') setNow(Date.now());
    });
    return () => subscription.remove();
  }, []);
  return dayKey(now, timeZone);
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius,
    borderWidth: StyleSheet.hairlineWidth * 2,
  },
  texts: { flex: 1, gap: 2 },
  kicker: { textTransform: 'uppercase', letterSpacing: 1 },
});
