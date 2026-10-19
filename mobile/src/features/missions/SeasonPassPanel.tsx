import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';

import { CosmeticEmblem } from '@/components/profile/CosmeticEmblem';
import { Body, Button3D, Caption, Card, Heading, Icon, PressableScale, ProgressBar, Text } from '@/components/ui';
import type { SeasonTier } from '@/features/progression/api';
import { useClaimSeasonTier, useSeasonPassQuery } from '@/features/progression/queries';
import { RewardChips } from '@/features/progression/RewardChips';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

const NODE = 68;
const NODE_GAP = spacing.sm;
const FADE = 28;
const UPCOMING = 4;

/** Free season pass: 50 tiers on a horizontal track, the tier to play for centered. */
export function SeasonPassPanel() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const pass = useSeasonPassQuery();
  const [selected, setSelected] = useState<number | null>(null);
  const track = useRef<ComponentRef<typeof ScrollView>>(null);

  const tiers = pass.data?.tiers ?? [];
  const firstClaimable = tiers.find((tier) => tier.claimable)?.tier;
  const focusTier = selected ?? firstClaimable ?? Math.min(tiers.length, (pass.data?.currentTier ?? 0) + 1);
  const selectedTier = tiers.find((tier) => tier.tier === focusTier);

  // Bring the tier to play for into the middle on first load; afterwards the player scrolls freely.
  const scrolled = useRef(false);
  const loaded = pass.data !== undefined;
  useEffect(() => {
    if (!loaded || scrolled.current) return;
    scrolled.current = true;
    const offset = (focusTier - 1) * (NODE + NODE_GAP) - (width - spacing.md * 2 - NODE) / 2;
    track.current?.scrollTo({ x: Math.max(0, offset), animated: false });
  }, [focusTier, loaded, width]);

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
  const upcoming = tiers.filter((tier) => tier.tier > currentTier && tier.tier !== focusTier).slice(0, UPCOMING);

  return (
    <View style={styles.panel}>
      <View style={styles.summary}>
        <Text variant="title">{t('seasonPass.tier', { current: currentTier, total })}</Text>
        <ProgressBar
          progress={intoTier / Math.max(1, xpPerTier)}
          color={colors.gold}
          accessibilityLabel={t('seasonPass.xpA11y', { current: intoTier, total: xpPerTier })}
        />
        <Caption>
          {currentTier >= total
            ? t('seasonPass.complete')
            : t('seasonPass.nextTier', { xp: formatNumber(Math.max(0, xpPerTier - intoTier), language) })}
        </Caption>
      </View>

      <View>
        <ScrollView ref={track} horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.track}>
          {tiers.map((tier) => (
            <TierNode
              key={tier.tier}
              tier={tier}
              reached={tier.tier <= currentTier}
              selected={tier.tier === focusTier}
              onPress={() => setSelected(tier.tier)}
            />
          ))}
        </ScrollView>
        {/* Fading edges show the track keeps going in both directions. */}
        <LinearGradient
          pointerEvents="none"
          colors={[colors.background, `${colors.background}00`]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fade, styles.fadeLeft]}
        />
        <LinearGradient
          pointerEvents="none"
          colors={[`${colors.background}00`, colors.background]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.fade, styles.fadeRight]}
        />
      </View>

      {selectedTier ? <TierDetail tier={selectedTier} /> : null}

      {upcoming.length > 0 ? (
        <View style={styles.upcoming}>
          <Heading>{t('seasonPass.upcoming')}</Heading>
          {upcoming.map((tier) => (
            <PressableScale
              key={tier.tier}
              accessibilityRole="button"
              accessibilityLabel={t('seasonPass.tierTitle', { tier: tier.tier })}
              onPress={() => setSelected(tier.tier)}
              style={[styles.upcomingRow, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
            >
              <View style={[styles.upcomingTier, { backgroundColor: colors.surfaceRaised }]}>
                <Text variant="label" allowFontScaling={false}>
                  {tier.tier}
                </Text>
              </View>
              <View style={styles.upcomingChips}>
                <RewardChips reward={tier.reward} />
              </View>
            </PressableScale>
          ))}
        </View>
      ) : null}
    </View>
  );
}

function TierNode({ tier, reached, selected, onPress }: { tier: SeasonTier; reached: boolean; selected: boolean; onPress: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const background = tier.claimable ? colors.gold : reached ? colors.brand : colors.surface;
  const edge = tier.claimable ? colors.goldEdge : reached ? colors.brandEdge : colors.border;
  const foreground = tier.claimable ? colors.background : reached ? colors.onBrand : colors.textMuted;
  const state = tier.claimed ? 'claimed' : tier.claimable ? 'claimable' : reached ? 'reached' : 'locked';
  const avatar = tier.reward.unlocks.find((unlock) => unlock.kind === 'avatar');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={t(`seasonPass.nodeA11y.${state}`, { tier: tier.tier })}
      onPress={onPress}
      style={[styles.node, { backgroundColor: background, borderBottomColor: edge, borderColor: selected ? colors.text : 'transparent' }]}
    >
      {avatar ? (
        <CosmeticEmblem kind="avatar" id={avatar.itemId} size={NODE * 0.62} locked={!reached && !tier.claimable} />
      ) : tier.reward.bonusPacks > 0 ? (
        <Icon name="gift" size={28} color={foreground} />
      ) : (
        <Icon name="ribbon" size={26} color={foreground} />
      )}
      <View style={[styles.tierTag, { backgroundColor: colors.background }]}>
        {tier.claimed ? (
          <Icon name="checkmark" size={13} tone="success" />
        ) : (
          <Text variant="caption" allowFontScaling={false}>
            {tier.tier}
          </Text>
        )}
      </View>
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
  track: { gap: NODE_GAP, paddingTop: spacing.sm, paddingBottom: spacing.md, paddingHorizontal: FADE / 2 },
  fade: { position: 'absolute', top: 0, bottom: 0, width: FADE },
  fadeLeft: { left: 0 },
  fadeRight: { right: 0 },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: radius,
    borderWidth: 2,
    borderBottomWidth: 5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierTag: { position: 'absolute', bottom: -11, minWidth: 26, height: 20, paddingHorizontal: 6, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  upcoming: { gap: spacing.xs },
  upcomingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius,
    borderBottomWidth: 3,
  },
  upcomingTier: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  upcomingChips: { flex: 1 },
  centered: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  loader: { paddingVertical: spacing.xl },
});
