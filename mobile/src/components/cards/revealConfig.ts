import type { HapticPattern } from '@/lib/haptics';
import type { SoundName } from '@/lib/sounds';
import { rarityStyles, type Rarity } from '@/theme/rarity';
import type { CardFinish } from '@/types/card';

export type RevealEffects = {
  /** Full-area color flash at the flip. */
  flash: boolean;
  /** Radial burst of light behind the card (epic and up). */
  burst: boolean;
  /** Rotating light rays behind the card (legendary). */
  rays: boolean;
  /** Prismatic rainbow sequence (mythic). */
  prism: boolean;
  /** Particle count for the explosion; 0 disables it. */
  particles: number;
  /** Darkens the surroundings during the suspense. */
  dim: boolean;
  /** Full 360° turn of the card after the flip. */
  spin: boolean;
};

/**
 * Extra beat after the rarity reveal for non-standard finishes: a foil light sweep
 * (holo, full art) or the gold sequence (gold flash, gold rays and particles).
 */
export type FinishBeat = {
  kind: 'foil' | 'gold';
  /** Start of the beat, from the beginning of the reveal. */
  atMs: number;
  durationMs: number;
  /** Gold particles; 0 for sober cards. */
  particles: number;
  /** Plays a sound and celebration haptics; false for sober cards. */
  celebrate: boolean;
};

export type RevealTimeline = {
  rarity: Rarity;
  /** Dramatic pause before the flip, card back pulsing. */
  suspenseMs: number;
  /** Duration of the 3D flip itself. */
  flipMs: number;
  /** Time the effects keep playing after the flip. */
  effectMs: number;
  totalMs: number;
  effects: RevealEffects;
  haptic: HapticPattern;
  /** Played as the card turns face up. */
  sound: SoundName;
  /** Whether a tap may jump to the end of the sequence. */
  skippable: boolean;
  /** Extra beat for holo, full art and gold prints; null for standard cards. */
  finishBeat: FinishBeat | null;
};

export type RevealOptions = {
  /**
   * Sober variant for sensitive cards: same rhythm as the rarity, but no particles,
   * no rays, no prism and no victory sound.
   */
  sober?: boolean;
  /** First time the player gets this rarity: the full sequence always plays. */
  firstTimeForRarity?: boolean;
  /** Reduce motion: keeps the flip short and drops every effect. */
  reduceMotion?: boolean;
  /** Print version of the card; non-standard finishes add a beat. */
  finish?: CardFinish;
};

const FLIP_MS = 420;

export function revealTimeline(rarity: Rarity, options: RevealOptions = {}): RevealTimeline {
  const style = rarityStyles[rarity];
  const { reveal } = style;
  const rank = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, mythic: 5 }[rarity];
  const sober = options.sober === true;

  let effects: RevealEffects = {
    flash: reveal.flash,
    burst: rank >= 3,
    rays: rank === 4,
    prism: rank === 5,
    particles: reveal.particles,
    dim: reveal.dimBackground,
    spin: rank >= 4,
  };
  if (sober) {
    effects = { ...effects, burst: false, rays: false, prism: false, particles: 0 };
  }

  let suspenseMs = reveal.suspenseMs;
  let flipMs = FLIP_MS;
  if (options.reduceMotion) {
    effects = { flash: false, burst: false, rays: false, prism: false, particles: 0, dim: effects.dim, spin: false };
    suspenseMs = Math.min(suspenseMs, 300);
    flipMs = 0;
  }

  const effectMs = options.reduceMotion ? 0 : Math.max(0, reveal.durationMs - suspenseMs - FLIP_MS);
  const baseTotal = suspenseMs + flipMs + effectMs;

  const finish = options.finish ?? 'standard';
  let finishBeat: FinishBeat | null = null;
  if (finish !== 'standard') {
    const gold = finish === 'gold';
    // The beat lands once the card has settled face up, after the rarity's own moment.
    const atMs = suspenseMs + flipMs + (options.reduceMotion ? 0 : gold ? 900 : 650);
    finishBeat = {
      kind: gold ? 'gold' : 'foil',
      atMs,
      durationMs: options.reduceMotion ? 0 : gold ? 1700 : 750,
      particles: gold && !sober && !options.reduceMotion ? 90 : 0,
      celebrate: !sober,
    };
  }

  return {
    rarity,
    suspenseMs,
    flipMs,
    effectMs,
    totalMs: finishBeat ? Math.max(baseTotal, finishBeat.atMs + finishBeat.durationMs) : baseTotal,
    effects,
    haptic: style.haptic,
    sound: sober ? 'flip' : style.sound,
    skippable: options.firstTimeForRarity !== true,
    finishBeat,
  };
}
