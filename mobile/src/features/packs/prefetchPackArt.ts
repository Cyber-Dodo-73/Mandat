import { Image, type ImageRef } from 'expo-image';

import { portraits } from '@/data/portraits';

import type { DrawnCard } from './types';

/**
 * Decodes the portraits of a freshly drawn pack while the player is still tearing it, so the
 * reveal never waits on image decoding. Best effort: a failure only means the image decodes on
 * display, as before. The returned refs keep the decoded images alive until `release` is called.
 */
export function prefetchPackArt(cards: readonly DrawnCard[]): { release: () => void } {
  const refs: ImageRef[] = [];
  let released = false;
  for (const drawn of cards) {
    const source = portraits[drawn.cardId];
    if (typeof source !== 'number') continue;
    Image.loadAsync(source)
      .then((ref) => {
        if (released) ref.release();
        else refs.push(ref);
      })
      .catch(() => undefined);
  }
  return {
    release: () => {
      released = true;
      for (const ref of refs) ref.release();
      refs.length = 0;
    },
  };
}
