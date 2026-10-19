import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { GestureDetector, usePanGesture } from 'react-native-gesture-handler';
import Animated, {
  cancelAnimation,
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { fontFamilies } from '@/theme';
import { palettes } from '@/theme/colors';
import { rarityRank, rarityStyles } from '@/theme/rarity';
import type { Card, CardFinish } from '@/types/card';

import { CardBack } from './CardBack';
import { CardFlip } from './CardFlip';
import { cardMetrics, type CardSize } from './cardMetrics';
import { GOLD, isFinishAvailable } from './finishes';
import { RevealBackdrop, RevealParticles, type RevealValues } from './RevealEffects';
import { revealTimeline } from './revealConfig';
import { TradingCard } from './TradingCard';

export type CardRevealResult = { skipped: boolean };

export type CardRevealProps = {
  card: Card;
  /** Print version drawn by the server; non-standard finishes add a beat to the reveal. */
  finish?: CardFinish;
  /** The player did not own this card (in this finish) before: shows the "New" badge. */
  isNew: boolean;
  /**
   * First time the player pulls this rarity: the full sequence plays and cannot be skipped.
   * Persisting which rarities were already seen is up to the caller.
   */
  firstTimeForRarity?: boolean;
  /** Pulsing rarity glow on the back before the flip (used on the last card of a pack). */
  hintRarity?: boolean;
  size?: CardSize;
  width?: number;
  /** Starts the reveal right away instead of waiting for a tap or a swipe on the card. */
  autoStart?: boolean;
  onRevealStart?: () => void;
  onRevealed?: (result: CardRevealResult) => void;
  /**
   * Tap or swipe on the face-up card (pack opening: send it away). The direction is the swipe's
   * horizontal sign, 1 for a tap.
   */
  onRevealedTap?: (direction: 1 | -1) => void;
  /** VoiceOver label of the face-up card when `onRevealedTap` is set. */
  revealedLabel?: string;
};

type Phase = 'idle' | 'running' | 'done';

const SWIPE_DISTANCE = 40;
const GOLD_PARTICLES = [GOLD.base, GOLD.glint, ...GOLD.gradient];
const FOIL_SWEEP = ['rgba(255,255,255,0)', 'rgba(255,255,255,0.7)', 'rgba(255,255,255,0)'] as const;
const GOLD_SWEEP = ['rgba(255,248,220,0)', 'rgba(255,236,170,0.85)', 'rgba(255,248,220,0)'] as const;

/**
 * Face-down card that flips with the reveal sequence of its rarity (brief §7.6), then the
 * beat of its finish. Fills its parent: the dim layer, rays and particles cover the whole
 * area. Tap or swipe to start; tap again to skip when the timeline allows it.
 */
export function CardReveal({
  card,
  finish: requestedFinish = 'standard',
  isNew,
  firstTimeForRarity = false,
  hintRarity = false,
  size = 'hero',
  width,
  autoStart = false,
  onRevealStart,
  onRevealed,
  onRevealedTap,
  revealedLabel,
}: CardRevealProps) {
  const { t } = useTranslation();
  const reduceMotion = useReduceMotion();
  const metrics = cardMetrics(size, width);
  const finish = isFinishAvailable(card.rarity, requestedFinish) ? requestedFinish : 'standard';
  const timeline = useMemo(
    () => revealTimeline(card.rarity, { sober: card.sensitive, firstTimeForRarity, reduceMotion, finish }),
    [card.rarity, card.sensitive, firstTimeForRarity, reduceMotion, finish],
  );
  const rank = rarityRank(card.rarity);
  const beat = timeline.finishBeat;

  const [area, setArea] = useState<{ width: number; height: number } | null>(null);
  const [phase, setPhase] = useState<Phase>('idle');
  const [badgeVisible, setBadgeVisible] = useState(false);
  const phaseRef = useRef<Phase>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  const flip = useSharedValue(0);
  const spin = useSharedValue(0);
  const shake = useSharedValue(0);
  const pop = useSharedValue(1);
  const flash = useSharedValue(0);
  const goldFlash = useSharedValue(0);
  const sweep = useSharedValue(0);
  const badge = useSharedValue(0);
  const goldParticles = useSharedValue(0);
  const dim = useSharedValue(0);
  const burst = useSharedValue(0);
  const rays = useSharedValue(0);
  const raysRotation = useSharedValue(0);
  const prism = useSharedValue(0);
  const particles = useSharedValue(0);
  const gold = useSharedValue(0);
  const values: RevealValues = useMemo(
    () => ({ dim, burst, rays, raysRotation, prism, particles, gold }),
    [dim, burst, rays, raysRotation, prism, particles, gold],
  );

  const clearTimers = useCallback(() => {
    for (const timer of timers.current) clearTimeout(timer);
    timers.current = [];
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  const at = useCallback((ms: number, run: () => void) => {
    timers.current.push(setTimeout(run, ms));
  }, []);

  const finishReveal = useCallback(
    (skipped: boolean) => {
      if (phaseRef.current === 'done') return;
      clearTimers();
      phaseRef.current = 'done';
      setPhase('done');
      cancelAnimation(shake);
      shake.set(0);
      if (skipped) {
        cancelAnimation(spin);
        spin.set(0);
        flip.set(1);
        for (const value of [burst, prism, particles, goldParticles, sweep]) {
          cancelAnimation(value);
          value.set(0);
        }
        flash.set(0);
        goldFlash.set(0);
      }
      dim.set(withTiming(0, { duration: 450 }));
      rays.set(withTiming(0, { duration: 450 }));
      gold.set(withTiming(0, { duration: 450 }));
      if (isNew) {
        setBadgeVisible(true);
        badge.set(reduceMotion ? 1 : withSpring(1, { damping: 9, stiffness: 220 }));
        haptics.newCard();
        if (!card.sensitive) playSound('new_card');
      }
      onRevealed?.({ skipped });
    },
    [badge, burst, card.sensitive, clearTimers, dim, flash, flip, gold, goldFlash, goldParticles, isNew, onRevealed, particles, prism, rays, reduceMotion, shake, spin, sweep],
  );

  const playFinishBeat = useCallback(() => {
    if (!beat) return;
    if (beat.kind === 'gold') {
      if (beat.celebrate) {
        haptics.flipLegendary();
        playSound('reveal_legendary');
      } else {
        haptics.flipRare();
      }
      if (reduceMotion) return;
      goldFlash.set(withSequence(withTiming(beat.celebrate ? 0.9 : 0.4, { duration: 90 }), withTiming(0, { duration: 600 })));
      sweep.set(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }));
      if (beat.celebrate) {
        gold.set(withTiming(1, { duration: 400 }));
        if (raysRotation.get() === 0) {
          raysRotation.set(withRepeat(withTiming(Math.PI * 2, { duration: 9000, easing: Easing.linear }), -1));
        }
      }
      if (beat.particles > 0) goldParticles.set(withTiming(1, { duration: 1500, easing: Easing.out(Easing.quad) }));
      pop.set(withSequence(withTiming(1.06, { duration: 140 }), withSpring(1, { damping: 10, stiffness: 180 })));
    } else {
      haptics.flipRare();
      if (beat.celebrate) playSound('reveal_uncommon');
      if (reduceMotion) return;
      sweep.set(withTiming(1, { duration: beat.durationMs, easing: Easing.inOut(Easing.quad) }));
    }
  }, [beat, gold, goldFlash, goldParticles, pop, raysRotation, reduceMotion, sweep]);

  const start = useCallback(() => {
    if (phaseRef.current !== 'idle') return;
    phaseRef.current = 'running';
    setPhase('running');
    onRevealStart?.();
    const { suspenseMs, flipMs, effectMs, effects } = timeline;

    // 1. Suspense: surroundings darken, the card trembles harder for rarer cards.
    if (effects.dim) dim.set(withTiming(0.78, { duration: Math.max(250, suspenseMs) }));
    if (suspenseMs > 0 && !reduceMotion) {
      const swings = Math.max(1, Math.floor(suspenseMs / 90));
      shake.set(withRepeat(withSequence(withTiming(-1, { duration: 45 }), withTiming(1, { duration: 45 })), swings, true));
    }
    // Building heartbeat: light ticks closer and closer until the flip.
    for (const tick of timeline.suspenseTicksMs) at(tick, () => haptics.tearTick());

    // 2. Flip.
    at(suspenseMs, () => {
      cancelAnimation(shake);
      shake.set(withTiming(0, { duration: 60 }));
      playSound('flip');
      flip.set(withTiming(1, { duration: flipMs, easing: Easing.out(Easing.cubic) }));
    });

    // 3. The card faces up: haptics, sound and effects of the rarity.
    at(suspenseMs + flipMs * 0.5, () => {
      haptics[timeline.haptic]();
      if (timeline.sound !== 'flip') playSound(timeline.sound);
      if (reduceMotion) return;
      pop.set(withSequence(withTiming(1.08, { duration: 120 }), withSpring(1, { damping: 10, stiffness: 180 })));
      if (effects.flash) flash.set(withSequence(withTiming(rank >= 4 ? 0.95 : 0.7, { duration: 70 }), withTiming(0, { duration: 420 })));
      if (effects.burst) burst.set(withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
      if (effects.rays || effects.prism) {
        rays.set(withTiming(1, { duration: 500 }));
        raysRotation.set(withRepeat(withTiming(Math.PI * 2, { duration: 9000, easing: Easing.linear }), -1));
      }
      if (effects.prism) prism.set(withTiming(1, { duration: Math.max(1200, effectMs * 0.8), easing: Easing.out(Easing.quad) }));
      if (effects.particles > 0) particles.set(withTiming(1, { duration: 1400, easing: Easing.out(Easing.quad) }));
    });

    // 4. Legendary and mythic cards turn once more on themselves.
    if (effects.spin) {
      at(suspenseMs + flipMs + 80, () => {
        spin.set(withTiming(360, { duration: 1000, easing: Easing.inOut(Easing.cubic) }));
      });
    }

    // 5. Holo, full art and gold prints: an extra beat once the card has settled.
    if (beat) at(beat.atMs, playFinishBeat);

    at(timeline.totalMs, () => finishReveal(false));
  }, [at, beat, burst, dim, finishReveal, flash, flip, onRevealStart, particles, playFinishBeat, pop, prism, rank, rays, raysRotation, reduceMotion, shake, spin, timeline]);

  const handleTap = useCallback(
    (direction: 1 | -1 = 1) => {
      if (phaseRef.current === 'idle') start();
      else if (phaseRef.current === 'running' && timeline.skippable) finishReveal(true);
      else if (phaseRef.current === 'done') onRevealedTap?.(direction);
    },
    [finishReveal, onRevealedTap, start, timeline.skippable],
  );

  useEffect(() => {
    if (autoStart) start();
  }, [autoStart, start]);

  const swipe = usePanGesture({
    activeOffsetX: [-12, 12],
    onDeactivate: (event) => {
      if (Math.abs(event.translationX) > SWIPE_DISTANCE) scheduleOnRN(handleTap, event.translationX < 0 ? -1 : 1);
    },
  });

  const cardStyle = useAnimatedStyle(() => ({
    transform: [
      { rotateZ: `${shake.get() * Math.min(4, 0.8 + rank * 0.7)}deg` },
      { scale: pop.get() },
    ],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.get() }));
  const goldFlashStyle = useAnimatedStyle(() => ({ opacity: goldFlash.get() }));
  const sweepStyle = useAnimatedStyle(() => ({
    opacity: sweep.get() > 0 && sweep.get() < 1 ? 1 : 0,
    transform: [{ translateX: (sweep.get() * 2.4 - 1.2) * metrics.width }, { rotate: '18deg' }],
  }));
  const badgeStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, badge.get() * 2),
    transform: [{ scale: 0.4 + badge.get() * 0.6 }, { rotate: '-8deg' }],
  }));

  const onLayout = (event: LayoutChangeEvent) => {
    const { width: w, height: h } = event.nativeEvent.layout;
    setArea((current) => (current && current.width === w && current.height === h ? current : { width: w, height: h }));
  };

  const style = rarityStyles[card.rarity];
  // Epic and up glow during the suspense, even when the back was not hinting before.
  const glow = hintRarity || (phase === 'running' && rank >= 3) ? card.rarity : undefined;

  return (
    <View style={styles.root} onLayout={onLayout}>
      {area ? (
        <RevealBackdrop
          rarity={card.rarity}
          effects={timeline.effects}
          values={values}
          width={area.width}
          height={area.height}
          goldBeat={beat?.kind === 'gold' && beat.celebrate}
        />
      ) : null}

      <GestureDetector gesture={swipe}>
        <Pressable
          onPress={() => handleTap(1)}
          accessibilityRole="button"
          accessibilityLabel={
            phase === 'idle' ? t('cards.revealHint') : phase === 'done' && onRevealedTap ? revealedLabel : undefined
          }
          style={styles.center}
        >
          <Animated.View style={cardStyle}>
            <CardFlip
              progress={flip}
              spin={spin}
              width={metrics.width}
              height={metrics.height}
              back={<CardBack size={size} width={metrics.width} glow={glow} />}
              front={
                <TradingCard card={card} finish={finish} size={size} width={metrics.width} interactive={phase === 'done'} />
              }
            />
            {beat ? (
              <View
                pointerEvents="none"
                style={[StyleSheet.absoluteFill, { borderRadius: metrics.radius, overflow: 'hidden' }]}
              >
                <Animated.View style={[styles.sweep, { width: metrics.width * 0.5, height: metrics.height * 1.6 }, sweepStyle]}>
                  <LinearGradient
                    colors={beat.kind === 'gold' ? GOLD_SWEEP : FOIL_SWEEP}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                </Animated.View>
              </View>
            ) : null}
            {badgeVisible ? (
              <Animated.View style={[styles.badge, { backgroundColor: palettes.dark.accent }, badgeStyle]}>
                <Text allowFontScaling={false} style={styles.badgeText}>
                  {t('cards.newBadge')}
                </Text>
              </Animated.View>
            ) : null}
          </Animated.View>
        </Pressable>
      </GestureDetector>

      {area ? (
        <>
          <RevealParticles
            rarity={card.rarity}
            count={timeline.effects.particles}
            seed={card.number}
            progress={particles}
            width={area.width}
            height={area.height}
          />
          {beat && beat.particles > 0 ? (
            <RevealParticles
              rarity={card.rarity}
              palette={GOLD_PARTICLES}
              count={beat.particles}
              seed={card.number * 7 + 3}
              progress={goldParticles}
              width={area.width}
              height={area.height}
            />
          ) : null}
        </>
      ) : null}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: rank >= 4 ? '#FFFFFF' : style.color }, flashStyle]}
      />
      {beat?.kind === 'gold' ? (
        <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: GOLD.base }, goldFlashStyle]} />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignSelf: 'stretch' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  sweep: { position: 'absolute', top: '-30%', left: '25%' },
  badge: {
    position: 'absolute',
    top: -12,
    right: -10,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 20,
  },
  badgeText: {
    fontFamily: fontFamilies.displayHeavy,
    fontSize: 15,
    color: palettes.dark.onAccent,
  },
});
