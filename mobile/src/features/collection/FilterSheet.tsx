import { StyleSheet, View } from 'react-native';

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
    <Sheet
      visible={visible}
      onClose={onClose}
      title={t('collection.filters.title')}
      footer={
        <>
          <Button3D label={t('collection.filters.show', { count: resultCount })} size="lg" fullWidth onPress={onClose} />
          <Button3D
            label={t('collection.filters.reset')}
            variant="ghost"
            fullWidth
            disabled={active === 0}
            onPress={() => onFiltersChange(EMPTY_FILTERS)}
          />
        </>
      }
    >
      <View style={styles.content}>
        <Group label={t('collection.sort.label')} block>
          <SegmentedControl<SortKey>
            accessibilityLabel={t('collection.sort.label')}
            value={sort}
            onChange={onSortChange}
            options={[
              { value: 'owned', label: t('collection.sort.owned') },
              { value: 'number', label: t('collection.sort.number') },
              { value: 'rarity', label: t('collection.sort.rarity') },
              { value: 'obtained', label: t('collection.sort.obtained') },
            ]}
          />
        </Group>

        <Group label={t('collection.filters.ownership')} block>
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
      </View>
    </Sheet>
  );
}

/** A titled group: chips wrap in a row, `block` children (segmented controls) take the full width. */
function Group({ label, children, block = false }: { label: string; children: React.ReactNode; block?: boolean }) {
  return (
    <View style={styles.group}>
      <Text variant="heading">{label}</Text>
      {block ? children : <View style={styles.chips}>{children}</View>}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  group: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
