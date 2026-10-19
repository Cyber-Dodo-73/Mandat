import { ScrollView, StyleSheet, View } from 'react-native';

import { Button3D, SegmentedControl, Sheet, Text } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { spacing } from '@/theme';
import { RARITIES, rarityStyles } from '@/theme/rarity';
import { CARD_FINISHES } from '@/types/card';

import {
  CONTINENTS,
  countActiveFilters,
  EMPTY_FILTERS,
  ERAS,
  toggleValue,
  type CollectionFilters,
  type Ownership,
  type SortKey,
} from './collectionModel';
import { FilterChip } from './FilterChip';

type FilterSheetProps = {
  visible: boolean;
  onClose: () => void;
  filters: CollectionFilters;
  onFiltersChange: (filters: CollectionFilters) => void;
  sort: SortKey;
  onSortChange: (sort: SortKey) => void;
  resultCount: number;
};

export function FilterSheet({
  visible,
  onClose,
  filters,
  onFiltersChange,
  sort,
  onSortChange,
  resultCount,
}: FilterSheetProps) {
  const { t } = useTranslation();
  const active = countActiveFilters(filters);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('collection.filters.title')}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Group label={t('collection.sort.label')}>
          <SegmentedControl<SortKey>
            accessibilityLabel={t('collection.sort.label')}
            value={sort}
            onChange={onSortChange}
            options={[
              { value: 'number', label: t('collection.sort.number') },
              { value: 'rarity', label: t('collection.sort.rarity') },
              { value: 'obtained', label: t('collection.sort.obtained') },
            ]}
          />
        </Group>

        <Group label={t('collection.filters.ownership')}>
          <SegmentedControl<Ownership>
            accessibilityLabel={t('collection.filters.ownership')}
            value={filters.ownership}
            onChange={(ownership) => onFiltersChange({ ...filters, ownership })}
            options={[
              { value: 'all', label: t('collection.filters.all') },
              { value: 'owned', label: t('collection.filters.owned') },
              { value: 'missing', label: t('collection.filters.missing') },
            ]}
          />
        </Group>

        <Group label={t('collection.filters.rarity')}>
          {RARITIES.map((rarity) => (
            <FilterChip
              key={rarity}
              label={t(`rarity.${rarity}`)}
              dotColor={rarityStyles[rarity].color}
              selected={filters.rarities.includes(rarity)}
              onToggle={() => onFiltersChange({ ...filters, rarities: toggleValue(filters.rarities, rarity) })}
            />
          ))}
        </Group>

        <Group label={t('collection.filters.continent')}>
          {CONTINENTS.map((continent) => (
            <FilterChip
              key={continent}
              label={t(`collection.continents.${continent}`)}
              selected={filters.continents.includes(continent)}
              onToggle={() => onFiltersChange({ ...filters, continents: toggleValue(filters.continents, continent) })}
            />
          ))}
        </Group>

        <Group label={t('collection.filters.era')}>
          {ERAS.map((era) => (
            <FilterChip
              key={era}
              label={t(`collection.eras.${era}`)}
              selected={filters.eras.includes(era)}
              onToggle={() => onFiltersChange({ ...filters, eras: toggleValue(filters.eras, era) })}
            />
          ))}
        </Group>

        <Group label={t('collection.filters.finish')}>
          {CARD_FINISHES.map((finish) => (
            <FilterChip
              key={finish}
              label={t(`cards.finish.${finish}`)}
              selected={filters.finishes.includes(finish)}
              onToggle={() => onFiltersChange({ ...filters, finishes: toggleValue(filters.finishes, finish) })}
            />
          ))}
        </Group>
      </ScrollView>

      <View style={styles.actions}>
        <Button3D
          label={t('collection.filters.reset')}
          variant="secondary"
          disabled={active === 0}
          onPress={() => onFiltersChange(EMPTY_FILTERS)}
        />
        <View style={styles.primary}>
          <Button3D label={t('collection.filters.show', { count: resultCount })} fullWidth onPress={onClose} />
        </View>
      </View>
    </Sheet>
  );
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.group}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 460 },
  content: { gap: spacing.lg, paddingBottom: spacing.md },
  group: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actions: { flexDirection: 'row', gap: spacing.sm, paddingTop: spacing.sm },
  primary: { flex: 1 },
});
