import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';

import { useSettingsStore } from '@/features/settings/store';

// Built by scripts/sounds/build.py from CC0 Kenney packs (see assets/sounds/LICENSES.md).
// Short UI effects are WAV (no decoder delay), longer musical ones are MP3.
const SOURCES = {
  // UI
  tap: require('../../assets/sounds/tap.wav'),
  toggle: require('../../assets/sounds/toggle.wav'),
  // Cards and packs
  tear: require('../../assets/sounds/tear.wav'),
  flip: require('../../assets/sounds/flip.wav'),
  card_slide: require('../../assets/sounds/card_slide.wav'),
  suspense_build: require('../../assets/sounds/suspense_build.mp3'),
  reveal_common: require('../../assets/sounds/reveal_common.wav'),
  reveal_uncommon: require('../../assets/sounds/reveal_uncommon.wav'),
  reveal_rare: require('../../assets/sounds/reveal_rare.mp3'),
  reveal_epic: require('../../assets/sounds/reveal_epic.mp3'),
  reveal_legendary: require('../../assets/sounds/reveal_legendary.mp3'),
  reveal_mythic: require('../../assets/sounds/reveal_mythic.mp3'),
  new_card: require('../../assets/sounds/new_card.wav'),
  // Progression and rewards
  coin: require('../../assets/sounds/coin.wav'),
  mission_complete: require('../../assets/sounds/mission_complete.mp3'),
  level_up: require('../../assets/sounds/level_up.mp3'),
  // Quiz and duel
  answer_correct: require('../../assets/sounds/answer_correct.wav'),
  answer_wrong: require('../../assets/sounds/answer_wrong.wav'),
  duel_clash: require('../../assets/sounds/duel_clash.wav'),
  duel_win: require('../../assets/sounds/duel_win.mp3'),
  duel_lose: require('../../assets/sounds/duel_lose.mp3'),
} satisfies Record<string, AudioSource>;

export type SoundName = keyof typeof SOURCES;

// The files are already loudness-matched by the build script (UI ticks quiet, card handling medium,
// rewards loud), so these are only small trims for very frequent sounds.
const VOLUME: Partial<Record<SoundName, number>> = {
  tap: 0.8,
  toggle: 0.8,
  flip: 0.9,
};

const players = new Map<SoundName, AudioPlayer>();
let initialized = false;

/** Preloads every effect once so playback starts without delay. */
export async function initSounds(): Promise<void> {
  if (initialized) return;
  initialized = true;
  // Game effects follow the silent switch and never interrupt the user's music.
  await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' });
  for (const name of Object.keys(SOURCES) as SoundName[]) {
    const player = createAudioPlayer(SOURCES[name]);
    player.volume = VOLUME[name] ?? 1;
    players.set(name, player);
  }
}

export function playSound(name: SoundName): void {
  if (!useSettingsStore.getState().soundEnabled) return;
  const player = players.get(name);
  if (!player) return;
  player
    .seekTo(0)
    .then(() => player.play())
    .catch(() => undefined);
}

/** Stops a sound that may still be playing (e.g. `suspense_build` when the reveal is skipped). */
export function stopSound(name: SoundName): void {
  const player = players.get(name);
  if (!player) return;
  player.pause();
  player.seekTo(0).catch(() => undefined);
}

export function releaseSounds(): void {
  for (const player of players.values()) player.release();
  players.clear();
  initialized = false;
}
