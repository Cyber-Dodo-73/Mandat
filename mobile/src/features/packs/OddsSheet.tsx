import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { Body, Button3D, Caption, Heading, Sheet, Text } from '@/components/ui';
import { formatPercent, useLanguage, useTranslation } from '@/i18n';
import { errorMessageKey } from '@/lib/api';
import { RARITIES, rarityStyles, spacing, useTheme } from '@/theme';

import { usePackOddsQuery } from './queries';
import type { FinishOdds, PackOdds, PityCounters, SlotOdds } from './types';

type OddsSheetProps = {
  visible: boolean;
  onClose: () => void;
  packId: string;
  pity: PityCounters;
};

/** Exact pull rates and pity guarantees, as served by the API (store requirement). */
export function OddsSheet({ visible, onClose, packId, pity }: OddsSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const odds = usePackOddsQuery(packId, visible);

  return (
    <Sheet visible={visible} onClose={onClose} title={t('packs.oddsLink')}>
      <Body tone="muted">{t('packs.odds.intro')}</Body>
      {odds.data ? (
        <OddsContent odds={odds.data} pity={pity} />
      ) : odds.isError ? (
        <Body tone="danger">{t(errorMessageKey(odds.error))}</Body>
      ) : (
        <ActivityIndicator color={colors.textMuted} />
      )}
      <Button3D label={t('common.close')} variant="secondary" fullWidth onPress={onClose} />
    </Sheet>
  );
}

function OddsContent({ odds, pity }: { odds: PackOdds; pity: PityCounters }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <>
      {odds.slots.map((group) => (
        <SlotGroup key={group.slots.join('-')} group={group} />
      ))}
      {odds.continentFallback ? <Caption>{t('packs.odds.continentFallback')}</Caption> : null}
      <View style={[styles.divider, { backgroundColor: colors.border }]} />
      <Heading>{t('packs.odds.finishesTitle')}</Heading>
      {odds.finishes
        .filter((finish) => finish.finish !== 'standard')
        .map((finish) => (
          <FinishRow key={finish.finish} odds={finish} />
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
    </>
  );
}

function FinishRow({ odds }: { odds: FinishOdds }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const conditions = [
    odds.minRarity ? t('packs.odds.finishMinRarity', { rarity: t(`rarity.${odds.minRarity}`) }) : null,
    odds.guaranteedSlotOnly ? t('packs.odds.finishSlot5') : null,
  ].filter(Boolean);
  return (
    <View style={styles.rateRow}>
      <View style={styles.flex}>
        <Body>{t(`cards.finish.${odds.finish}`)}</Body>
        {conditions.length > 0 ? <Caption>{conditions.join(', ')}</Caption> : null}
      </View>
      <Text variant="bodyStrong">{formatPercent(odds.rate, language)}</Text>
    </View>
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
