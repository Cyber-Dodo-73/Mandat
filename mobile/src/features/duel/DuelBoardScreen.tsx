import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { TradingCard } from '@/components/cards';
import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { Body, Button3D, Caption, Heading, Icon, PressableScale, Text } from '@/components/ui';
import { getCard } from '@/data/catalog';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { radius, spacing, useTheme } from '@/theme';
import type { StatKey } from '@/types/card';

import { activeDuel, useDuel, usePlayRound, type Duel } from './api';
import { ArenaCard } from './ArenaCard';
import { CountUp } from './CountUp';
import { DuelEnd } from './DuelEnd';
import { StatPills } from './StatPills';
import { handsLeft, latestRound, roundView, type EffectLine, type RoundView } from './viewModel';

const MAX_ROUNDS = 3;
const FLIP_MS = 420;
const VERDICT_DELAY_MS = 1300;

/** The duel board: both teams visible, the announced domain, one face-down card per round. */
export function DuelBoardScreen({ duelId }: { duelId: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const duel = useDuel(duelId);

  useEffect(() => {
    if (duel.data && duel.data.status !== 'active') activeDuel.clear();
  }, [duel.data]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xs }]}>
      {duel.data ? (
        <Board duel={duel.data} bottomInset={insets.bottom} />
      ) : duel.error ? (
        <View style={styles.centered}>
          <Body align="center">{describeError(duel.error, t)}</Body>
          <Button3D label={t('common.back')} variant="secondary" onPress={() => router.back()} />
        </View>
      ) : (
        <View style={styles.centered}>
          <ActivityIndicator color={colors.textMuted} />
        </View>
      )}
    </View>
  );
}

type Phase = { kind: 'choose' } | { kind: 'pending'; cardId: string } | { kind: 'reveal'; round: RoundView; final: Duel };

function Board({ duel, bottomInset }: { duel: Duel; bottomInset: number }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const online = useIsOnline();
  const reduceMotion = useReduceMotion();
  const play = usePlayRound(duel.id);
  const [selected, setSelected] = useState<string | null>(null);
  const [phase, setPhase] = useState<Phase>({ kind: 'choose' });
  const [verdict, setVerdict] = useState(false);
  const verdictTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (verdictTimer.current) clearTimeout(verdictTimer.current);
  }, []);

  // While a round is revealed, the board keeps showing the state from before it was played.
  const shown = phase.kind === 'reveal' ? phase.final : duel;
  const hands = handsLeft(phase.kind === 'reveal' ? { ...duel, ...previousHands(phase) } : duel);
  const arenaWidth = Math.min(150, (width - spacing.md * 3) / 2);
  const domain = (phase.kind === 'reveal' ? phase.round.domain : duel.nextDomain) ?? null;

  if (duel.status !== 'active' && phase.kind !== 'reveal') {
    return <DuelEnd duel={duel} />;
  }

  const submit = () => {
    if (!selected || play.isPending) return;
    haptics.tap();
    playSound('flip');
    const cardId = selected;
    setPhase({ kind: 'pending', cardId });
    play.mutate(cardId, {
      onSuccess: (next) => {
        const last = latestRound(next);
        if (!last) {
          setPhase({ kind: 'choose' });
          return;
        }
        const view = roundView(last, getCard, language);
        setSelected(null);
        setVerdict(false);
        setPhase({ kind: 'reveal', round: view, final: next });
        playSound('duel_clash');
        verdictTimer.current = setTimeout(
          () => {
            setVerdict(true);
            if (view.winner === 'player') {
              haptics.flipEpic();
              playSound('answer_correct');
            } else if (view.winner === 'ai') {
              haptics.error();
              playSound('answer_wrong');
            } else {
              haptics.tap();
            }
          },
          reduceMotion ? 0 : VERDICT_DELAY_MS,
        );
      },
      onError: () => setPhase({ kind: 'choose' }),
    });
  };

  const continueAfterReveal = () => {
    haptics.tap();
    setVerdict(false);
    setPhase({ kind: 'choose' });
  };

  const roundNumber = phase.kind === 'reveal' ? phase.round.round : Math.min(MAX_ROUNDS, duel.roundsPlayed + 1);
  const playerCardInArena = phase.kind === 'reveal' ? phase.round.player.cardId : phase.kind === 'pending' ? phase.cardId : selected;
  const aiCardInArena = phase.kind === 'reveal' ? phase.round.ai.cardId : phase.kind === 'pending' ? 'hidden' : null;
  const revealed = phase.kind === 'reveal';
  const scores = phase.kind === 'reveal' && verdict ? phase.final : shownScoresBefore(phase, duel);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('duel.quit')} hitSlop={12} onPress={() => router.back()}>
          <Icon name="close" size={28} tone="textMuted" />
        </PressableScale>
        <Heading style={styles.flex}>{t('duel.round', { round: roundNumber, total: MAX_ROUNDS })}</Heading>
        <View style={styles.score} accessible accessibilityLabel={t('duel.scoreA11y', { player: scores.playerScore, ai: scores.aiScore })}>
          <Caption tone="muted">{t('duel.you')}</Caption>
          <Text variant="title">
            {scores.playerScore} – {scores.aiScore}
          </Text>
          <Caption tone="muted">{t('duel.ai')}</Caption>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Team label={t('duel.aiTeam')} cardIds={shown.aiCards} left={hands.ai} domain={domain} />

        {domain ? (
          <Animated.View
            key={`${roundNumber}-${domain}`}
            entering={reduceMotion ? undefined : ZoomIn.springify().damping(14)}
            style={[styles.domain, { backgroundColor: colors.accent }]}
            accessible
            accessibilityLabel={t('duel.domainA11y', { domain: t(`cards.stats.${domain}`) })}
          >
            <Caption color={colors.onAccent}>{t('duel.domain')}</Caption>
            <Text variant="title" color={colors.onAccent}>
              {t(`cards.stats.${domain}`)}
            </Text>
          </Animated.View>
        ) : null}

        <View style={styles.arena}>
          <View style={styles.arenaSide}>
            <Caption tone="muted">{t('duel.you')}</Caption>
            <ArenaCard
              cardId={playerCardInArena}
              width={arenaWidth}
              revealed={revealed}
              outcome={revealed && verdict ? outcomeFor('player', phase.round.winner) : null}
            />
            {revealed ? <ValueLine base={phase.round.player.base} value={phase.round.player.value} /> : null}
          </View>
          <View style={styles.versus}>
            <Text variant="heading" tone="muted">
              {t('duel.versus')}
            </Text>
          </View>
          <View style={styles.arenaSide}>
            <Caption tone="muted">{t('duel.ai')}</Caption>
            {aiCardInArena === 'hidden' ? (
              <ArenaCard cardId={shown.aiCardsLeft[0] ?? null} width={arenaWidth} revealed={false} />
            ) : (
              <ArenaCard
                cardId={aiCardInArena}
                width={arenaWidth}
                revealed={revealed}
                flipDelayMs={120}
                outcome={revealed && verdict ? outcomeFor('ai', phase.round.winner) : null}
              />
            )}
            {revealed ? <ValueLine base={phase.round.ai.base} value={phase.round.ai.value} delayMs={120} /> : null}
          </View>
        </View>

        {revealed ? <EffectsList effects={phase.round.effects} /> : null}
        {revealed && verdict ? <Verdict round={phase.round} /> : null}

        {phase.kind !== 'reveal' ? (
          <View style={styles.hand}>
            <Caption tone="muted">{t('duel.yourHand')}</Caption>
            <View style={styles.handRow}>
              {hands.player.map((cardId) => {
                const card = getCard(cardId);
                if (!card) return null;
                const active = selected === cardId;
                return (
                  <PressableScale
                    key={cardId}
                    haptic="toggle"
                    disabled={phase.kind !== 'choose'}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    accessibilityLabel={`${card.name[language] || card.name.fr}, ${domain ? `${t(`cards.stats.${domain}`)} ${card.stats[domain]}` : ''}`}
                    onPress={() => setSelected(active ? null : cardId)}
                    style={[styles.handCard, { borderColor: active ? colors.accent : 'transparent', transform: [{ translateY: active ? -8 : 0 }] }]}
                  >
                    <TradingCard card={card} size="thumb" interactive={false} gyro={false} />
                    {domain ? (
                      <View style={[styles.domainValue, { backgroundColor: active ? colors.accent : colors.surfaceRaised }]}>
                        <Text variant="label" color={active ? colors.onAccent : colors.text}>
                          {card.stats[domain]}
                        </Text>
                      </View>
                    ) : null}
                  </PressableScale>
                );
              })}
            </View>
            {selected && getCard(selected) ? <StatPills stats={getCard(selected)!.stats} highlight={domain} /> : null}
          </View>
        ) : null}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: bottomInset + spacing.md, borderTopColor: colors.border }]}>
        {!online ? <OfflineNotice message={t('duel.offline')} /> : null}
        {play.error && phase.kind === 'choose' ? <Body tone="danger">{describeError(play.error, t)}</Body> : null}
        {phase.kind === 'reveal' ? (
          <Button3D
            label={phase.final.status === 'active' ? t('duel.nextRound') : t('duel.seeResult')}
            fullWidth
            size="lg"
            disabled={!verdict}
            onPress={continueAfterReveal}
          />
        ) : (
          <Button3D
            label={selected ? t('duel.playFaceDown') : t('duel.pickCard')}
            icon="flash"
            fullWidth
            size="lg"
            disabled={!selected || !online || phase.kind === 'pending'}
            loading={phase.kind === 'pending'}
            onPress={submit}
          />
        )}
      </View>
    </View>
  );
}

/** Hands as they were before the revealed round: its two cards are still "in play". */
function previousHands(phase: Extract<Phase, { kind: 'reveal' }>): Pick<Duel, 'playerCardsLeft' | 'aiCardsLeft'> {
  return {
    playerCardsLeft: [...phase.final.playerCardsLeft, phase.round.player.cardId],
    aiCardsLeft: [...phase.final.aiCardsLeft, phase.round.ai.cardId],
  };
}

/** Scores shown before the verdict lands: the revealed round is not counted yet. */
function shownScoresBefore(phase: Phase, duel: Duel): { playerScore: number; aiScore: number } {
  if (phase.kind !== 'reveal') return duel;
  const { winner } = phase.round;
  return {
    playerScore: phase.final.playerScore - (winner === 'player' ? 1 : 0),
    aiScore: phase.final.aiScore - (winner === 'ai' ? 1 : 0),
  };
}

function outcomeFor(side: 'player' | 'ai', winner: RoundView['winner']): 'win' | 'lose' | 'draw' {
  if (winner === 'draw') return 'draw';
  return winner === side ? 'win' : 'lose';
}

function Team({ label, cardIds, left, domain }: { label: string; cardIds: readonly string[]; left: readonly string[]; domain: StatKey | null }) {
  const { colors } = useTheme();
  return (
    <View style={styles.team}>
      <Caption tone="muted">{label}</Caption>
      <View style={styles.teamRow}>
        {cardIds.map((cardId) => {
          const card = getCard(cardId);
          if (!card) return null;
          const used = !left.includes(cardId);
          return (
            <View key={cardId} style={[styles.teamCard, { opacity: used ? 0.35 : 1 }]}>
              <TradingCard card={card} size="thumb" interactive={false} gyro={false} />
              {domain && !used ? (
                <View style={[styles.domainValue, { backgroundColor: colors.surfaceRaised }]}>
                  <Text variant="label">{card.stats[domain]}</Text>
                </View>
              ) : null}
            </View>
          );
        })}
      </View>
    </View>
  );
}

function ValueLine({ base, value, delayMs = 0 }: { base: number; value: number; delayMs?: number }) {
  const { t } = useTranslation();
  const changed = base !== value;
  return (
    <View style={styles.valueLine} accessible accessibilityLabel={t('duel.valueA11y', { base, value })}>
      <CountUp from={0} to={base} delayMs={FLIP_MS + delayMs} durationMs={500} variant="display" />
      {changed ? (
        <Animated.View entering={FadeIn.delay(FLIP_MS + 700)} style={styles.modified}>
          <Icon name="arrow-forward" size={16} tone="textMuted" />
          <CountUp from={base} to={value} delayMs={FLIP_MS + 750 + delayMs} durationMs={350} variant="title" tone={value > base ? 'success' : 'danger'} />
        </Animated.View>
      ) : null}
    </View>
  );
}

function EffectsList({ effects }: { effects: readonly EffectLine[] }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  if (effects.length === 0) return null;
  return (
    <View style={styles.effects}>
      {effects.map((effect, index) => {
        const stat = effect.stat === 'any' ? t('duel.anyStat') : t(`cards.stats.${effect.stat}`);
        const text =
          effect.type === 'tieBreaker'
            ? t('duel.effect.tieBreaker')
            : t('duel.effect.change', { delta: effect.delta > 0 ? `+${effect.delta}` : String(effect.delta), stat });
        return (
          <Animated.View
            key={`${effect.cardId}-${index}`}
            entering={FadeInDown.delay(FLIP_MS + 500 + index * 180)}
            style={[
              styles.effect,
              { borderColor: effect.side === 'player' ? colors.accent : colors.border, backgroundColor: colors.surface },
            ]}
            accessible
            accessibilityLabel={`${t(effect.side === 'player' ? 'duel.you' : 'duel.ai')}: ${effect.abilityName}, ${text}`}
          >
            <Icon name={effect.side === 'player' ? 'sparkles' : 'hardware-chip'} size={16} tone={effect.side === 'player' ? 'accent' : 'textMuted'} />
            <Text variant="label" style={styles.flex} numberOfLines={1}>
              {effect.abilityName}
            </Text>
            <Caption tone={effect.delta < 0 ? 'danger' : effect.delta > 0 ? 'success' : 'muted'}>{text}</Caption>
          </Animated.View>
        );
      })}
    </View>
  );
}

function Verdict({ round }: { round: RoundView }) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const tone = round.winner === 'player' ? 'success' : round.winner === 'ai' ? 'danger' : 'muted';
  return (
    <Animated.View entering={reduceMotion ? undefined : ZoomIn.springify().damping(12)} style={styles.verdict}>
      <Text variant="title" tone={tone} align="center">
        {t(`duel.verdict.${round.winner}`)}
      </Text>
      {round.tieRule ? (
        <Caption tone="muted" align="center">
          {t(`duel.tieRule.${round.tieRule}`)}
        </Caption>
      ) : null}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
  score: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  body: { padding: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  team: { gap: spacing.xxs },
  teamRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  teamCard: { alignItems: 'center' },
  domain: { alignSelf: 'center', alignItems: 'center', paddingHorizontal: spacing.lg, paddingVertical: spacing.xs, borderRadius: radius },
  arena: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'center', gap: spacing.xs },
  arenaSide: { alignItems: 'center', gap: spacing.xxs },
  versus: { alignSelf: 'center', paddingHorizontal: spacing.xxs },
  valueLine: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, minHeight: 44 },
  modified: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs },
  effects: { gap: spacing.xs },
  effect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius,
    borderWidth: 1,
  },
  verdict: { gap: spacing.xxs, paddingVertical: spacing.xs },
  hand: { gap: spacing.xs, alignItems: 'center' },
  handRow: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm },
  handCard: { alignItems: 'center', borderWidth: 2, borderRadius: 12, padding: 2 },
  domainValue: {
    position: 'absolute',
    bottom: -8,
    minWidth: 28,
    alignItems: 'center',
    paddingHorizontal: spacing.xs,
    borderRadius: 10,
  },
  footer: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
