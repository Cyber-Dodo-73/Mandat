import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';

import { Body, Button3D, Caption, Card, Heading, Icon, PressableScale, ProgressBar, Text } from '@/components/ui';
import type { SeasonTier } from '@/features/progression/api';
import { useClaimSeasonTier, useSeasonPassQuery } from '@/features/progression/queries';
import { RewardChips } from '@/features/progression/RewardChips';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

const NODE = 56;
const NODE_GAP = spacing.sm;

/** Free season pass: 50 tiers on a horizontal track, claimable ones highlighted. */
export function SeasonPassPanel() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const pass = useSeasonPassQuery();
  const [selected, setSelected] = useState<number | null>(null);
  const track = useRef<ComponentRef<typeof ScrollView>>(null);

  const tiers = pass.data?.tiers ?? [];
  const firstClaimable = tiers.find((tier) => tier.claimable)?.tier;
  const focusTier = selected ?? firstClaimable ?? Math.min(tiers.length, (pass.data?.currentTier ?? 0) + 1);
  const selectedTier = tiers.find((tier) => tier.tier === focusTier);

  // Bring the next interesting tier into view on first load only; afterwards the player scrolls freely.
  const scrolled = useRef(false);
  const loaded = pass.data !== undefined;
  useEffect(() => {
    if (!loaded || scrolled.current) return;
    scrolled.current = true;
    track.current?.scrollTo({ x: Math.max(0, (focusTier - 2) * (NODE + NODE_GAP)), animated: false });
  }, [focusTier, loaded]);

  if (!pass.data) {
    return pass.isError ? (
      <View style={styles.centered}>
        <Body tone="muted" align="center">
          {describeError(pass.error, t)}
        </Body>
        <Button3D label={t('common.retry')} variant="secondary" onPress={() => void pass.refetch()} />
      </View>
    ) : (
      <ActivityIndicator color={colors.textMuted} style={styles.loader} />
    );
  }

  const { currentTier, seasonXp, xpPerTier } = pass.data;
  const total = tiers.length;
  const intoTier = currentTier >= total ? xpPerTier : seasonXp - currentTier * xpPerTier;

  return (
    <View style={styles.panel}>
      <View style={styles.summary}>
        <Text variant="title">{t('seasonPass.tier', { current: currentTier, total })}</Text>
        <ProgressBar
          progress={intoTier / Math.max(1, xpPerTier)}
          accessibilityLabel={t('seasonPass.xpA11y', { current: intoTier, total: xpPerTier })}
        />
        <Caption>
          {currentTier >= total
            ? t('seasonPass.complete')
            : t('seasonPass.nextTier', { xp: formatNumber(Math.max(0, xpPerTier - intoTier), language) })}
        </Caption>
      </View>

      <ScrollView ref={track} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
        {tiers.map((tier) => (
          <TierNode key={tier.tier} tier={tier} reached={tier.tier <= currentTier} selected={tier.tier === focusTier} onPress={() => setSelected(tier.tier)} />
        ))}
      </ScrollView>

      {selectedTier ? <TierDetail tier={selectedTier} /> : null}
    </View>
  );
}

function TierNode({ tier, reached, selected, onPress }: { tier: SeasonTier; reached: boolean; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const background = tier.claimable ? colors.accent : reached ? colors.surfaceRaised : colors.surface;
  const foreground = tier.claimable ? colors.onAccent : reached ? colors.text : colors.textMuted;
  const state = tier.claimed ? 'claimed' : tier.claimable ? 'claimable' : reached ? 'reached' : 'locked';

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={t(`seasonPass.nodeA11y.${state}`, { tier: tier.tier })}
      onPress={onPress}
      style={[
        styles.node,
        { backgroundColor: background, borderColor: selected ? colors.text : tier.claimable ? colors.accentEdge : colors.border },
      ]}
    >
      {tier.claimed ? (
        <Icon name="checkmark" size={22} tone="success" />
      ) : (
        <Text variant="label" color={foreground} allowFontScaling={false}>
          {tier.tier}
        </Text>
      )}
      {tier.reward.bonusPacks > 0 || tier.reward.unlocks.length > 0 ? (
        <View style={[styles.star, { backgroundColor: colors.background }]}>
          <Icon name={tier.reward.unlocks.length > 0 ? 'star' : 'gift'} size={12} tone="accent" />
        </View>
      ) : null}
    </PressableScale>
  );
}

function TierDetail({ tier }: { tier: SeasonTier }) {
  const { t } = useTranslation();
  const claim = useClaimSeasonTier();
  return (
    <Card>
      <Heading>{t('seasonPass.tierTitle', { tier: tier.tier })}</Heading>
      <RewardChips reward={tier.reward} />
      {tier.claimed ? <Caption tone="success">{t('seasonPass.claimed')}</Caption> : null}
      {tier.claimable ? (
        <Button3D label={t('seasonPass.claim')} icon="gift" loading={claim.isPending} onPress={() => claim.mutate(tier.tier)} fullWidth />
      ) : null}
      {!tier.claimed && !tier.claimable ? <Caption>{t('seasonPass.locked', { xp: tier.requiredXp })}</Caption> : null}
      {claim.isError ? <Caption tone="danger">{describeError(claim.error, t)}</Caption> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  panel: { gap: spacing.lg },
  summary: { gap: spacing.sm },
  track: { gap: NODE_GAP, paddingVertical: spacing.xs },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: radius,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  star: { position: 'absolute', top: -6, right: -6, borderRadius: 10, padding: 2 },
  centered: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  loader: { paddingVertical: spacing.xl },
});
