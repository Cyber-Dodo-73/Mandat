import * as Crypto from 'expo-crypto';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

import { TradingCard } from '@/components/cards';
import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { Body, Button3D, Caption, Card as Surface, Heading, Icon, PressableScale, Sheet, Text } from '@/components/ui';
import { useProgressionQuery } from '@/features/player/queries';
import { ProfileCardActions } from '@/features/profile/ProfileCardActions';
import { useCountdown } from '@/hooks/useCountdown';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { formatCountdown, formatDate, formatNumber, useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { playCoin, playSound } from '@/lib/sounds';
import { parseInstant } from '@/lib/time';
import { spacing, useTheme } from '@/theme';
import type { Card, CardFinish } from '@/types/card';

import { craftCostPreview, holoUpgradeCostPreview, recyclePreview, useEconomyRules, useLimitsQuery } from './economy';
import { useCraftMutation, useOwnedCopies, useRecycleMutation, useUpgradeMutation, type OwnedCard } from './queries';

type Feedback = { tone: 'success' | 'error'; message: string } | null;

/** Copies owned per finish, recycling duplicates and crafting a missing card. */
export function CollectionActions({ card }: { card: Card }) {
  const { t } = useTranslation();
  const online = useIsOnline();
  const copies = useOwnedCopies(card.id);
  const [feedback, setFeedback] = useState<Feedback>(null);

  return (
    <>
      <Surface>
        <Heading>{t('card.copies')}</Heading>
        {online ? null : <OfflineNotice message={t('card.actions.offline')} />}
        {copies.length === 0 ? (
          <CraftPanel card={card} online={online} onFeedback={setFeedback} />
        ) : (
          copies.map((copy) => (
            <CopyRow key={copy.finish} card={card} copy={copy} online={online} onFeedback={setFeedback} />
          ))
        )}
        {feedback ? <FeedbackLine feedback={feedback} /> : null}
      </Surface>
      <ProfileCardActions card={card} />
    </>
  );
}

function CopyRow({
  card,
  copy,
  online,
  onFeedback,
}: {
  card: Card;
  copy: OwnedCard;
  online: boolean;
  onFeedback: (feedback: Feedback) => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [open, setOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const duplicates = copy.quantity - 1;
  const firstMs = parseInstant(copy.firstObtainedAt);

  return (
    <View style={styles.copyRow}>
      <View style={styles.copyText}>
        <Text variant="bodyStrong">
          {t('card.copiesOfFinish', { count: copy.quantity, finish: t(`cards.finish.${copy.finish}`) })}
        </Text>
        {firstMs !== null ? (
          <Caption>{t('card.firstObtained', { date: formatDate(new Date(firstMs), language, { dateStyle: 'long' }) })}</Caption>
        ) : null}
      </View>
      {copy.finish === 'standard' ? (
        <Button3D
          label={t('card.actions.upgrade')}
          accessibilityHint={t('card.actions.upgradeA11y')}
          icon="sparkles"
          size="sm"
          variant="brand"
          disabled={!online}
          onPress={() => setUpgradeOpen(true)}
        />
      ) : null}
      {duplicates > 0 ? (
        <Button3D
          label={t('card.actions.recycle')}
          icon="sync"
          size="sm"
          variant="secondary"
          disabled={!online}
          onPress={() => setOpen(true)}
        />
      ) : null}
      {copy.finish === 'standard' ? (
        <UpgradeSheet visible={upgradeOpen} onClose={() => setUpgradeOpen(false)} card={card} onFeedback={onFeedback} />
      ) : null}
      <RecycleSheet
        visible={open}
        onClose={() => setOpen(false)}
        card={card}
        finish={copy.finish}
        duplicates={duplicates}
        onFeedback={onFeedback}
      />
    </View>
  );
}

function RecycleSheet({
  visible,
  onClose,
  card,
  finish,
  duplicates,
  onFeedback,
}: {
  visible: boolean;
  onClose: () => void;
  card: Card;
  finish: CardFinish;
  duplicates: number;
  onFeedback: (feedback: Feedback) => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const recycle = useRecycleMutation();
  const rules = useEconomyRules();
  const [quantity, setQuantity] = useState(1);
  const amount = Math.min(Math.max(1, quantity), Math.max(1, duplicates));
  const preview = recyclePreview(rules, card.rarity, finish, amount);

  const confirm = () => {
    recycle.mutate(
      { cardId: card.id, finish, quantity: amount },
      {
        onSuccess: (result) => {
          haptics.missionComplete();
          playCoin(result.influenceGained, 0);
          onFeedback({
            tone: 'success',
            message: t('card.actions.recycled', { amount: formatNumber(result.influenceGained, language) }),
          });
        },
        onError: (error) => {
          haptics.error();
          onFeedback({ tone: 'error', message: describeError(error, t) });
        },
      },
    );
    setQuantity(1);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('card.actions.recycleTitle')}>
      <View style={styles.sheet}>
        <Body>{t('card.actions.recycleExplain', { finish: t(`cards.finish.${finish}`) })}</Body>
        <Stepper value={amount} min={1} max={Math.max(1, duplicates)} onChange={setQuantity} />
        <InfluenceLine label={t('card.actions.gain')} amount={preview} />
        <Button3D label={t('card.actions.recycleConfirm', { count: amount })} fullWidth onPress={confirm} />
      </View>
    </Sheet>
  );
}

const UPGRADE_PREVIEW_WIDTH = 170;
const HOLO_FADE_MS = 900;

/**
 * Standard → holo for Influence. The preview shows the card turning holo (cross-fade + shine pulse);
 * one Idempotency-Key per opening of the sheet, reused if the request is retried.
 */
function UpgradeSheet({
  visible,
  onClose,
  card,
  onFeedback,
}: {
  visible: boolean;
  onClose: () => void;
  card: Card;
  onFeedback: (feedback: Feedback) => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const reduceMotion = useReduceMotion();
  const rules = useEconomyRules();
  const progression = useProgressionQuery();
  const upgrade = useUpgradeMutation();
  const [idempotencyKey, setIdempotencyKey] = useState(() => Crypto.randomUUID());
  const cost = holoUpgradeCostPreview(rules, card.rarity);
  const balance = progression.data?.influence;
  const affordable = balance === undefined || balance >= cost;
  const holo = useSharedValue(0);

  useEffect(() => {
    if (!visible) return;
    holo.set(0);
    if (reduceMotion) {
      holo.set(1);
      return;
    }
    holo.set(withRepeat(withSequence(withDelay(500, withTiming(1, { duration: HOLO_FADE_MS })), withDelay(900, withTiming(0, { duration: 400 }))), -1));
  }, [holo, reduceMotion, visible]);

  const holoStyle = useAnimatedStyle(() => ({ opacity: holo.get() }));

  const confirm = () => {
    upgrade.mutate(
      { cardId: card.id, idempotencyKey },
      {
        onSuccess: (result) => {
          haptics.flipRare();
          playSound('reveal_rare');
          playCoin(result.influenceSpent, 0);
          setIdempotencyKey(Crypto.randomUUID());
          onFeedback({
            tone: 'success',
            message: t('card.actions.upgraded', { amount: formatNumber(result.influenceSpent, language) }),
          });
          onClose();
        },
        onError: (error) => {
          haptics.error();
          onFeedback({ tone: 'error', message: describeError(error, t) });
        },
      },
    );
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('card.actions.upgradeTitle')}>
      <View style={styles.sheet}>
        <View style={styles.upgradePreview}>
          <TradingCard card={card} finish="standard" width={UPGRADE_PREVIEW_WIDTH} interactive={false} gyro={false} />
          <Animated.View style={[StyleSheet.absoluteFill, styles.upgradeOverlay, holoStyle]} pointerEvents="none">
            <TradingCard card={card} finish="holo" width={UPGRADE_PREVIEW_WIDTH} interactive={false} gyro={false} />
          </Animated.View>
        </View>
        <Body>{t('card.actions.upgradeExplain')}</Body>
        <InfluenceLine label={t('card.actions.cost')} amount={cost} />
        {balance !== undefined ? (
          <Caption>{t('card.actions.balance', { amount: formatNumber(balance, language) })}</Caption>
        ) : null}
        <Button3D
          label={t('card.actions.upgradeConfirm')}
          icon="sparkles"
          fullWidth
          disabled={!affordable || upgrade.isPending}
          loading={upgrade.isPending}
          onPress={confirm}
        />
        {affordable ? null : <Caption>{t('card.actions.notEnough')}</Caption>}
      </View>
    </Sheet>
  );
}

function CraftPanel({ card, online, onFeedback }: { card: Card; online: boolean; onFeedback: (feedback: Feedback) => void }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const progression = useProgressionQuery();
  const limits = useLimitsQuery();
  const craft = useCraftMutation();
  const rules = useEconomyRules();
  const [open, setOpen] = useState(false);
  const cost = craftCostPreview(rules, card.rarity);
  const balance = progression.data?.influence;
  const affordable = balance === undefined || balance >= cost;
  const allowance = limits.data?.crafts;
  const craftsLeft = allowance === undefined || allowance.available > 0;
  const nextCraftIn = useCountdown(allowance && allowance.available === 0 ? (allowance.nextAt ?? null) : null, () => {
    void limits.refetch();
  });

  const confirm = () => {
    craft.mutate(
      { cardId: card.id },
      {
        onSuccess: (result) => {
          haptics.newCard();
          playSound('new_card');
          onFeedback({
            tone: 'success',
            message: t('card.actions.crafted', { amount: formatNumber(result.influenceSpent, language) }),
          });
        },
        onError: (error) => {
          haptics.error();
          onFeedback({ tone: 'error', message: describeError(error, t) });
        },
      },
    );
    setOpen(false);
  };

  return (
    <View style={styles.craft}>
      <Body>{t('card.notOwned')}</Body>
      <InfluenceLine label={t('card.actions.cost')} amount={cost} />
      {balance !== undefined ? (
        <Caption>{t('card.actions.balance', { amount: formatNumber(balance, language) })}</Caption>
      ) : null}
      {allowance ? (
        <Caption>{t('collection.craftAllowance.available', { available: allowance.available, max: allowance.max })}</Caption>
      ) : null}
      <Button3D
        label={t('card.actions.craft')}
        icon="hammer-outline"
        fullWidth
        disabled={!online || !affordable || !craftsLeft || craft.isPending}
        loading={craft.isPending}
        onPress={() => setOpen(true)}
      />
      {!craftsLeft ? (
        <Caption>{t('collection.craftAllowance.next', { time: formatCountdown(nextCraftIn) })}</Caption>
      ) : affordable ? null : (
        <Caption>{t('card.actions.notEnough')}</Caption>
      )}
      <Sheet visible={open} onClose={() => setOpen(false)} title={t('card.actions.craftTitle')}>
        <View style={styles.sheet}>
          <Body>{t('card.actions.craftExplain')}</Body>
          <InfluenceLine label={t('card.actions.cost')} amount={cost} />
          <Button3D label={t('card.actions.craftConfirm')} fullWidth onPress={confirm} />
        </View>
      </Sheet>
    </View>
  );
}

function Stepper({ value, min, max, onChange }: { value: number; min: number; max: number; onChange: (value: number) => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const step = (delta: number) => {
    const next = Math.min(max, Math.max(min, value + delta));
    if (next !== value) {
      haptics.tap();
      onChange(next);
    }
  };
  return (
    <View style={styles.stepper} accessibilityRole="adjustable" accessibilityValue={{ min, max, now: value }}>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('card.actions.less')} disabled={value <= min} onPress={() => step(-1)}>
        <Icon name="remove-circle-outline" size={36} color={value <= min ? colors.border : colors.text} />
      </PressableScale>
      <Text variant="title" style={styles.stepValue}>
        {value}
      </Text>
      <PressableScale accessibilityRole="button" accessibilityLabel={t('card.actions.more')} disabled={value >= max} onPress={() => step(1)}>
        <Icon name="add-circle-outline" size={36} color={value >= max ? colors.border : colors.text} />
      </PressableScale>
    </View>
  );
}

function InfluenceLine({ label, amount }: { label: string; amount: number }) {
  const language = useLanguage();
  const { colors } = useTheme();
  return (
    <View style={styles.influence}>
      <Text variant="label" tone="muted">
        {label}
      </Text>
      <View style={styles.influenceValue}>
        <Icon name="ribbon" size={18} color={colors.accent} />
        <Text variant="bodyStrong">{formatNumber(amount, language)}</Text>
      </View>
    </View>
  );
}

function FeedbackLine({ feedback }: { feedback: NonNullable<Feedback> }) {
  const { colors } = useTheme();
  return (
    <Text accessibilityRole="alert" variant="label" color={feedback.tone === 'success' ? colors.success : colors.danger}>
      {feedback.message}
    </Text>
  );
}

const styles = StyleSheet.create({
  copyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  copyText: { flex: 1, gap: 2 },
  craft: { gap: spacing.sm },
  sheet: { gap: spacing.md, paddingBottom: spacing.sm },
  stepper: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  stepValue: { minWidth: 48, textAlign: 'center' },
  influence: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  influenceValue: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  upgradePreview: { alignSelf: 'center' },
  upgradeOverlay: { alignItems: 'center' },
});
