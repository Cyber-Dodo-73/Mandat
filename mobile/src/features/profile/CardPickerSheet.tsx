import { FlashList } from '@shopify/flash-list';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CARD_RATIO, TradingCard } from '@/components/cards';
import { Body, Button3D, Caption, Icon, PressableScale, Sheet, TextField } from '@/components/ui';
import { getCard } from '@/data/catalog';
import { useCollectionQuery } from '@/features/collection/queries';
import { useLanguage, useTranslation } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';
import { RARITIES } from '@/theme/rarity';
import type { Card } from '@/types/card';

import { byBestFinish, refKey, sameRef, SHOWCASE_MAX, type CardRef } from './showcase';

type Mode = 'showcase' | 'favorite';

type CardPickerSheetProps = {
  mode: Mode | null;
  showcase: readonly CardRef[];
  favorite: CardRef | null | undefined;
  onToggleShowcase: (ref: CardRef) => void;
  onPickFavorite: (ref: CardRef | null) => void;
  onClose: () => void;
};

type Option = { ref: CardRef; card: Card };

const COLUMNS = 4;

const normalize = (text: string) => text.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

/** Pick owned cards (each finish counts separately): up to six for the showcase, one favorite. */
export function CardPickerSheet({ mode, showcase, favorite, onToggleShowcase, onPickFavorite, onClose }: CardPickerSheetProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { width, height } = useWindowDimensions();
  const collection = useCollectionQuery();
  const [query, setQuery] = useState('');

  // Rarest first, then the most special finish, then collector number.
  const options = useMemo<Option[]>(() => {
    const rarityRank = (card: Card) => RARITIES.indexOf(card.rarity);
    return (collection.data?.items ?? [])
      .map((item) => ({ ref: { cardId: item.cardId, finish: item.finish }, card: getCard(item.cardId) }))
      .filter((option): option is Option => Boolean(option.card))
      .sort(
        (a, b) => rarityRank(b.card) - rarityRank(a.card) || byBestFinish(a.ref, b.ref) || a.card.number - b.card.number,
      );
  }, [collection.data]);

  const visible = useMemo(() => {
    const needle = normalize(query.trim());
    if (!needle) return options;
    return options.filter(({ card }) => normalize(`${card.name.fr} ${card.name.en}`).includes(needle));
  }, [options, query]);

  const cell = Math.floor((width - spacing.lg * 2 - spacing.xs * (COLUMNS - 1)) / COLUMNS);
  const count = showcase.length;

  return (
    <Sheet
      visible={mode !== null}
      onClose={onClose}
      scroll={false}
      title={mode === 'favorite' ? t('profile.cardPicker.favoriteTitle') : t('profile.cardPicker.showcaseTitle', { count, max: SHOWCASE_MAX })}
    >
      <TextField
        label={t('profile.cardPicker.search')}
        value={query}
        onChangeText={setQuery}
        autoCorrect={false}
        returnKeyType="search"
      />
      {options.length === 0 ? (
        <Body tone="muted">{t('profile.cardPicker.empty')}</Body>
      ) : (
        <View style={{ height: Math.min(height * 0.5, (cell * CARD_RATIO + spacing.xs) * 3) }}>
          <FlashList
            data={visible}
            numColumns={COLUMNS}
            keyExtractor={(option) => refKey(option.ref)}
            renderItem={({ item }) => {
              const selected =
                mode === 'favorite' ? sameRef(favorite, item.ref) : showcase.some((entry) => sameRef(entry, item.ref));
              return (
                <PickerCell
                  option={item}
                  width={cell}
                  selected={selected}
                  label={item.card.name[language]}
                  onPress={() => (mode === 'favorite' ? onPickFavorite(item.ref) : onToggleShowcase(item.ref))}
                />
              );
            }}
            extraData={{ showcase, favorite, mode }}
          />
        </View>
      )}
      {mode === 'favorite' && favorite ? (
        <Button3D label={t('profile.cardPicker.clearFavorite')} variant="secondary" size="sm" fullWidth onPress={() => onPickFavorite(null)} />
      ) : null}
      {mode === 'showcase' ? <Caption>{t('profile.cardPicker.showcaseHint')}</Caption> : null}
      <Button3D label={t('common.close')} variant="secondary" fullWidth onPress={onClose} />
    </Sheet>
  );
}

function PickerCell({
  option,
  width,
  selected,
  label,
  onPress,
}: {
  option: Option;
  width: number;
  selected: boolean;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <PressableScale
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked: selected }}
      haptic="toggle"
      onPress={onPress}
      style={[styles.cell, { borderColor: selected ? colors.accent : 'transparent' }]}
    >
      <TradingCard card={option.card} finish={option.ref.finish} size="thumb" width={width - 4} interactive={false} gyro={false} />
      {selected ? (
        <View style={[styles.check, { backgroundColor: colors.accent }]}>
          <Icon name="checkmark" size={14} tone="onAccent" />
        </View>
      ) : null}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  cell: { borderWidth: 2, borderRadius: radius / 2, marginBottom: spacing.xs, marginRight: spacing.xs },
  check: { position: 'absolute', top: 4, right: 4, borderRadius: 12, width: 22, height: 22, alignItems: 'center', justifyContent: 'center' },
});
