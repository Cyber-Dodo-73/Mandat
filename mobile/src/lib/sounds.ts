import { createAudioPlayer, setAudioModeAsync, type AudioPlayer, type AudioSource } from 'expo-audio';

import { useSettingsStore } from '@/features/settings/store';

const SOURCES = {
  tap: require('../../assets/sounds/tap.wav'),
  tear: require('../../assets/sounds/tear.wav'),
  flip: require('../../assets/sounds/flip.wav'),
  reveal_common: require('../../assets/sounds/reveal_common.wav'),
  reveal_uncommon: require('../../assets/sounds/reveal_uncommon.wav'),
  reveal_rare: require('../../assets/sounds/reveal_rare.wav'),
  reveal_epic: require('../../assets/sounds/reveal_epic.wav'),
  reveal_legendary: require('../../assets/sounds/reveal_legendary.wav'),
  reveal_mythic: require('../../assets/sounds/reveal_mythic.wav'),
  new_card: require('../../assets/sounds/new_card.wav'),
  mission_complete: require('../../assets/sounds/mission_complete.wav'),
  level_up: require('../../assets/sounds/level_up.wav'),
  answer_correct: require('../../assets/sounds/answer_correct.wav'),
  answer_wrong: require('../../assets/sounds/answer_wrong.wav'),
} satisfies Record<string, AudioSource>;

export type SoundName = keyof typeof SOURCES;

const VOLUME: Partial<Record<SoundName, number>> = {
  tap: 0.35,
  flip: 0.6,
  tear: 0.7,
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

export function releaseSounds(): void {
  for (const player of players.values()) player.release();
  players.clear();
  initialized = false;
}
