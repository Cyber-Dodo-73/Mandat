import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming } from 'react-native-reanimated';

import { Body, Button3D, Card, Heading, Icon, Sheet, Text } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';
import { springs } from '@/theme/motion';

import type { StreakView } from './api';
import { streakPalette } from './palette';
import { usePurchaseFreeze } from './queries';

/** Freeze stock (earned + bought, capped), with the Influence purchase and its confirmation. */
export function FreezeInventory({ streak, online }: { streak: StreakView; online: boolean }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const [bought, setBought] = useState(false);
  const purchase = usePurchaseFreeze();
  const price = streak.freezePrices.influence;
  const full = streak.freezes >= streak.maxFreezes;
  const affordable = streak.influence >= price;

  const open = () => {
    purchase.reset();
    setBought(false);
    setConfirming(true);
  };

  const buy = () =>
    purchase.purchase('influence', {
      onSuccess: () => setBought(true),
    });

  return (
    <Card>
      <View style={styles.header}>
        <Heading>{t('streak.freezes.title')}</Heading>
        <Text variant="label" color={streakPalette.ice}>
          {t('streak.freezes.count', { count: streak.freezes, max: streak.maxFreezes })}
        </Text>
      </View>
      <View style={styles.slots}>
        {Array.from({ length: streak.maxFreezes }, (_, index) => (
          <FreezeSlot key={index} filled={index < streak.freezes} />
        ))}
      </View>
      <Body tone="muted">{t('streak.freezes.explain')}</Body>
      <Button3D
        label={full ? t('streak.freezes.full') : t('streak.freezes.buy', { price: formatNumber(price, language) })}
        icon={full ? 'checkmark-circle' : 'snow'}
        fullWidth
        variant={full ? 'secondary' : 'primary'}
        disabled={full || !online}
        onPress={open}
      />
      {streak.freezePrices.sceaux != null ? (
        <Text variant="caption" tone="muted" align="center">
          {t('streak.freezes.sceauxSoon')}
        </Text>
      ) : null}

      <Sheet visible={confirming} onClose={() => setConfirming(false)} title={bought ? t('streak.freezes.boughtTitle') : t('streak.freezes.confirmTitle')}>
        <View style={styles.sheetHero}>
          <FreezeSlot filled big celebrate={bought} />
        </View>
        {bought ? (
          <Body align="center">{t('streak.freezes.boughtBody', { count: purchase.data?.freezes ?? streak.freezes, max: streak.maxFreezes })}</Body>
        ) : (
          <>
            <Body align="center">{t('streak.freezes.confirmBody', { price: formatNumber(price, language) })}</Body>
            <View style={[styles.balance, { backgroundColor: colors.surfaceRaised }]}>
              <Icon name="ribbon" size={18} color={colors.gold} />
              <Text variant="label">
                {t('streak.freezes.balance', {
                  now: formatNumber(streak.influence, language),
                  after: formatNumber(Math.max(0, streak.influence - price), language),
                })}
              </Text>
            </View>
            {!affordable ? (
              <Text variant="label" color={colors.danger} align="center">
                {t('errors.insufficient_influence')}
              </Text>
            ) : null}
            {purchase.isError ? (
              <Text accessibilityRole="alert" variant="label" color={colors.danger} align="center">
                {describeError(purchase.error, t)}
              </Text>
            ) : null}
          </>
        )}
        {bought ? (
          <Button3D label={t('streak.freezes.great')} fullWidth onPress={() => setConfirming(false)} />
        ) : (
          <>
            <Button3D
              label={t('streak.freezes.confirm', { price: formatNumber(price, language) })}
              icon="snow"
              fullWidth
              disabled={!affordable || !online}
              loading={purchase.isPending}
              onPress={buy}
            />
            <Button3D label={t('streak.freezes.cancel')} variant="secondary" fullWidth onPress={() => setConfirming(false)} />
          </>
        )}
      </Sheet>
    </Card>
  );
}

/** An ice cube: chunky when filled, an empty socket otherwise. Pops when just bought. */
function FreezeSlot({ filled, big = false, celebrate = false }: { filled: boolean; big?: boolean; celebrate?: boolean }) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!celebrate || reduceMotion) return;
    scale.set(withSequence(withTiming(1.25, { duration: 140 }), withSpring(1, springs.bounce)));
  }, [celebrate, reduceMotion, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));
  const size = big ? 96 : 64;
  return (
    <Animated.View style={[{ width: size, height: size + 6, borderRadius: radius, backgroundColor: filled ? streakPalette.iceEdge : colors.border }, style]}>
      <View
        style={[
          styles.cube,
          {
            width: size,
            height: size,
            backgroundColor: filled ? streakPalette.ice : colors.surfaceRaised,
            borderColor: filled ? 'rgba(255, 255, 255, 0.55)' : colors.border,
          },
        ]}
      >
        <Icon name="snow" size={big ? 52 : 34} color={filled ? streakPalette.onIce : colors.textMuted} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  slots: { flexDirection: 'row', gap: spacing.sm },
  cube: { borderRadius: radius, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  sheetHero: { alignItems: 'center', paddingVertical: spacing.sm },
  balance: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radius,
  },
});
