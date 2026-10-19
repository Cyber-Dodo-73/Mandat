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

/** Thumb width: the strip stays one compact row so the booster keeps the screen. */
const THUMB_WIDTH = 30;
/** Fixed strip height, reserved by the home layout so the booster never overlaps it. */
export const FIGURE_STRIP_HEIGHT = 56;

/** Compact "figure of the day" row under the top bar: the booster hub stays the focus. */
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
      style={[styles.strip, { backgroundColor: colors.surfaceRaised, borderBottomColor: colors.neutralButtonEdge }]}
    >
      <View pointerEvents="none">
        <TradingCard card={card} size="thumb" width={THUMB_WIDTH} />
      </View>
      <View style={styles.texts}>
        <Caption color={colors.gold} numberOfLines={1}>
          {t('home.figureOfTheDay.title')}
        </Caption>
        <Text variant="label" numberOfLines={1}>
          {name}
        </Text>
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
    height: FIGURE_STRIP_HEIGHT,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    paddingHorizontal: spacing.sm,
    borderRadius: radius,
    borderBottomWidth: 3,
  },
  texts: { flex: 1 },
});
