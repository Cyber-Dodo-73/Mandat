import { FlashList, type ListRenderItem } from '@shopify/flash-list';
import { router } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CardSilhouette, TradingCard } from '@/components/cards';
import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { Caption, EmptyState, Icon, PressableScale, Text, Title } from '@/components/ui';
import { allCards } from '@/data/catalog';
import { useIsOnline } from '@/hooks/useIsOnline';
import { formatPercent, useLanguage, useTranslation } from '@/i18n';
import { errorMessageKey } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { fontFamilies, radius, spacing, useTheme } from '@/theme';

import {
  buildEntries,
  collectionProgress,
  CONTINENTS,
  countActiveFilters,
  EMPTY_FILTERS,
  ERAS,
  filterEntries,
  sortEntries,
  type CollectionEntry,
  type CollectionFilters,
  type Progress,
  type SortKey,
} from './collectionModel';
import { FilterSheet } from './FilterSheet';
import { useCollectionQuery } from './queries';

const COLUMNS = 3;

export function CollectionScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const online = useIsOnline();
  const collection = useCollectionQuery();
  const [search, setSearch] = useState('');
  const [filters, setFilters] = useState<CollectionFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<SortKey>('number');
  const [sheetOpen, setSheetOpen] = useState(false);

  const entries = useMemo(() => buildEntries(allCards, collection.data?.items ?? []), [collection.data]);
  const progress = useMemo(() => collectionProgress(entries), [entries]);
  const visible = useMemo(
    () => sortEntries(filterEntries(entries, filters, search), sort),
    [entries, filters, search, sort],
  );

  // FlashList splits the row in equal columns; the card sits centered with a gutter.
  const cardWidth = Math.floor((width - spacing.md * 2) / COLUMNS - spacing.sm);
  const activeFilters = countActiveFilters(filters);

  const renderItem = useCallback<ListRenderItem<CollectionEntry>>(
    ({ item }) => <GridCell entry={item} width={cardWidth} />,
    [cardWidth],
  );

  const header = (
    <View style={styles.header}>
      <Title>{t('collection.title')}</Title>
      {online ? null : <OfflineNotice message={t('collection.offline')} />}
      <ProgressLedger progress={progress} />
      <View style={styles.toolbar}>
        <View style={[styles.search, { backgroundColor: colors.surfaceRaised, borderColor: colors.border }]}>
          <Icon name="search" size={18} color={colors.textMuted} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder={t('collection.searchPlaceholder')}
            placeholderTextColor={colors.textMuted}
            selectionColor={colors.accent}
            accessibilityLabel={t('collection.searchPlaceholder')}
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
            style={[styles.searchInput, { color: colors.text }]}
          />
        </View>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('collection.filters.open', { count: activeFilters })}
          onPress={() => {
            haptics.tap();
            setSheetOpen(true);
          }}
          style={[
            styles.filterButton,
            activeFilters > 0
              ? { backgroundColor: colors.accent, borderColor: colors.accent }
              : { backgroundColor: colors.surfaceRaised, borderColor: colors.border },
          ]}
        >
          <Icon name="options-outline" size={20} color={activeFilters > 0 ? colors.onAccent : colors.text} />
          {activeFilters > 0 ? (
            <Text variant="label" color={colors.onAccent}>
              {activeFilters}
            </Text>
          ) : null}
        </PressableScale>
      </View>
      <Caption>{t('collection.results', { count: visible.length })}</Caption>
    </View>
  );

  const empty = collection.isPending ? (
    <ActivityIndicator color={colors.textMuted} />
  ) : collection.isError && !collection.data ? (
    <EmptyState icon="cloud-offline-outline" message={t(errorMessageKey(collection.error))} />
  ) : (
    <EmptyState icon="search" message={t('collection.noResults')} />
  );

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <FlashList
        data={visible}
        renderItem={renderItem}
        keyExtractor={(entry) => entry.card.id}
        numColumns={COLUMNS}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.list}
        keyboardDismissMode="on-drag"
        showsVerticalScrollIndicator={false}
      />
      <FilterSheet
        visible={sheetOpen}
        onClose={() => setSheetOpen(false)}
        filters={filters}
        onFiltersChange={setFilters}
        sort={sort}
        onSortChange={setSort}
        resultCount={visible.length}
      />
    </View>
  );
}

/** One slot of the binder: the owned card (best finish) or its silhouette. */
const GridCell = memo(function GridCell({ entry, width }: { entry: CollectionEntry; width: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { card, owned, bestFinish, copies } = entry;
  return (
    <View style={styles.cell}>
      <PressableScale
        accessibilityRole="button"
        accessibilityHint={t('collection.openCard')}
        onPress={() => {
          haptics.tap();
          router.push({ pathname: '/card/[id]', params: { id: card.id, finish: bestFinish } });
        }}
      >
        {owned ? (
          <TradingCard card={card} finish={bestFinish} size="grid" width={width} />
        ) : (
          <CardSilhouette number={card.number} size="grid" width={width} />
        )}
        {copies > 1 ? (
          <View style={[styles.copies, { backgroundColor: colors.accent }]}>
            <Text variant="caption" color={colors.onAccent} allowFontScaling={false}>
              {t('collection.copiesShort', { count: copies })}
            </Text>
          </View>
        ) : null}
      </PressableScale>
    </View>
  );
});

/** Season completion: a big global figure, then a bar per continent and per era. */
function ProgressLedger({ progress }: { progress: ReturnType<typeof collectionProgress> }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  return (
    <View style={[styles.ledger, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={styles.ledgerTop}>
        <Text style={[styles.bigPercent, { color: colors.text }]} allowFontScaling={false}>
          {formatPercent(progress.global.ratio, language)}
        </Text>
        <Caption style={styles.ledgerCaption}>
          {t('collection.progress', { owned: progress.global.owned, total: progress.global.total })}
        </Caption>
      </View>
      <View style={styles.bars}>
        {CONTINENTS.map((continent) => (
          <MiniBar key={continent} label={t(`collection.continents.${continent}`)} progress={progress.byContinent[continent]} />
        ))}
      </View>
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <View style={styles.bars}>
        {ERAS.map((era) => (
          <MiniBar key={era} label={t(`collection.eras.${era}`)} progress={progress.byEra[era]} />
        ))}
      </View>
    </View>
  );
}

function MiniBar({ label, progress }: { label: string; progress: Progress }) {
  const { colors } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      style={styles.miniBar}
      accessible
      accessibilityLabel={t('collection.progressA11y', { label, owned: progress.owned, total: progress.total })}
    >
      <View style={styles.miniLabel}>
        <Caption numberOfLines={1} style={styles.flex}>
          {label}
        </Caption>
        <Caption tone="muted">
          {progress.owned}/{progress.total}
        </Caption>
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
        <View style={[styles.fill, { width: `${Math.round(progress.ratio * 100)}%`, backgroundColor: colors.accent }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  list: { paddingHorizontal: spacing.md, paddingBottom: spacing.xxl },
  header: { gap: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.md },
  toolbar: { flexDirection: 'row', gap: spacing.xs },
  search: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius,
    borderWidth: 1,
    minHeight: 48,
  },
  searchInput: { flex: 1, fontFamily: fontFamilies.bodyRegular, fontSize: 16, paddingVertical: spacing.xs },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    minHeight: 48,
    minWidth: 48,
    justifyContent: 'center',
    borderRadius: radius,
    borderWidth: 1,
  },
  cell: { alignItems: 'center', marginBottom: spacing.sm },
  copies: {
    position: 'absolute',
    top: spacing.xxs,
    right: spacing.xxs,
    paddingHorizontal: spacing.xs,
    borderRadius: radius,
  },
  ledger: { borderWidth: 1, borderRadius: radius, padding: spacing.md, gap: spacing.sm },
  ledgerTop: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  bigPercent: { fontFamily: fontFamilies.displayHeavy, fontSize: 44, lineHeight: 48 },
  ledgerCaption: { flexShrink: 1 },
  bars: { flexDirection: 'row', flexWrap: 'wrap', columnGap: spacing.md, rowGap: spacing.xs },
  miniBar: { width: '46%', gap: 4 },
  miniLabel: { flexDirection: 'row', gap: spacing.xxs },
  flex: { flex: 1 },
  track: { height: 6, borderRadius: 3, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  divider: { height: StyleSheet.hairlineWidth },
});
