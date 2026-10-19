import { StyleSheet, View } from 'react-native';

import { Body, Button3D, Caption, Heading, Sheet, Text } from '@/components/ui';
import { formatPercent, useLanguage, useTranslation } from '@/i18n';
import { RARITIES, rarityStyles, spacing, useTheme } from '@/theme';

import type { PackOdds, PityCounters, SlotOdds } from './types';

type OddsSheetProps = {
  visible: boolean;
  onClose: () => void;
  odds: PackOdds;
  pity: PityCounters;
};

/** Exact pull rates and pity guarantees, as served by the API (store requirement). */
export function OddsSheet({ visible, onClose, odds, pity }: OddsSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <Sheet visible={visible} onClose={onClose} title={t('packs.oddsLink')}>
      <Body tone="muted">{t('packs.odds.intro')}</Body>
      {odds.slots.map((group) => (
        <SlotGroup key={group.slots.join('-')} group={group} />
      ))}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Heading>{t('packs.odds.pityTitle')}</Heading>
      <PityRow
        label={t('packs.odds.pityEpic', { count: odds.pity.epicEvery })}
        value={t('packs.odds.pityProgress', { current: pity.packsSinceEpic, total: odds.pity.epicEvery })}
      />
      <PityRow
        label={t('packs.odds.pityLegendary', { count: odds.pity.legendaryEvery })}
        value={t('packs.odds.pityProgress', { current: pity.packsSinceLegendary, total: odds.pity.legendaryEvery })}
      />
      <Button3D label={t('common.close')} variant="secondary" fullWidth onPress={onClose} />
    </Sheet>
  );
}

function SlotGroup({ group }: { group: SlotOdds }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const first = group.slots[0] ?? 1;
  const last = group.slots[group.slots.length - 1] ?? first;
  const title =
    group.slots.length > 1
      ? t('packs.odds.slotsRange', { from: first, to: last })
      : t('packs.odds.slotSingle', { slot: first });

  return (
    <View style={styles.group}>
      <Text variant="label">{title}</Text>
      {RARITIES.filter((rarity) => group.rates[rarity] !== undefined).map((rarity) => (
        <View key={rarity} style={styles.rateRow}>
          <View style={[styles.dot, { backgroundColor: rarityStyles[rarity].color }]} />
          <Body style={styles.flex}>{t(`packs.odds.rarity.${rarity}`)}</Body>
          <Text variant="bodyStrong">{formatPercent(group.rates[rarity] ?? 0, language)}</Text>
        </View>
      ))}
    </View>
  );
}

function PityRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.rateRow}>
      <Body style={styles.flex}>{label}</Body>
      <Caption>{value}</Caption>
    </View>
  );
}

const DOT = 10;

const styles = StyleSheet.create({
  group: { gap: spacing.xxs },
  rateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2 },
  flex: { flex: 1 },
  divider: { height: StyleSheet.hairlineWidth * 2 },
});
