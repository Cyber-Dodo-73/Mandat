import { useEffect, useState } from 'react';
import { AppState, StyleSheet, View } from 'react-native';

import { useProgressionQuery } from '@/features/player/queries';

import { useCelebrations } from './celebrations';
import { LevelUpOverlay } from './LevelUpOverlay';
import { ReturnRecapSheet } from './ReturnRecapSheet';
import { readLastActiveAt, readLastSeenLevel, shouldShowReturnRecap, writeLastActiveAt, writeLastSeenLevel } from './returnRecap';
import { RewardToast } from './RewardToast';
import { useNotificationSync } from './useNotificationSync';

/**
 * Signed-in overlay layer: level-up and reward celebrations, the "welcome back" recap,
 * and the local reminders kept in sync with the server.
 */
export function ProgressionHost() {
  useNotificationSync();
  useLevelWatcher();
  const [showReturn, setShowReturn] = useState(() => shouldShowReturnRecap(readLastActiveAt(), Date.now()));
  const queue = useCelebrations((state) => state.queue);
  const dismiss = useCelebrations((state) => state.dismiss);

  useEffect(() => {
    writeLastActiveAt(Date.now());
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && shouldShowReturnRecap(readLastActiveAt(), Date.now())) setShowReturn(true);
      writeLastActiveAt(Date.now());
    });
    return () => subscription.remove();
  }, []);

  // One celebration at a time, in order: the next one waits until the current one is done.
  const current = queue[0];
  const toast = current?.type === 'reward' ? current : undefined;
  const levelUp = current?.type === 'levelUp' ? current : undefined;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {toast ? <RewardToast key={toast.id} reward={toast.reward} onDone={() => dismiss(toast.id)} /> : null}
      {levelUp ? (
        <LevelUpOverlay key={levelUp.id} level={levelUp.level} rewards={levelUp.rewards} onDone={() => dismiss(levelUp.id)} />
      ) : null}
      <ReturnRecapSheet visible={showReturn && !current} onClose={() => setShowReturn(false)} />
    </View>
  );
}

/**
 * Level-ups that don't come from a claim (pack opening, quiz, duel…) are spotted by comparing
 * the server level with the last one celebrated on this device. First launch only records it.
 */
function useLevelWatcher() {
  const level = useProgressionQuery().data?.level;
  const push = useCelebrations((state) => state.push);

  useEffect(() => {
    if (level === undefined) return;
    const lastSeen = readLastSeenLevel();
    writeLastSeenLevel(level);
    if (lastSeen !== null && level > lastSeen) push({ type: 'levelUp', level, rewards: null });
  }, [level, push]);
}
