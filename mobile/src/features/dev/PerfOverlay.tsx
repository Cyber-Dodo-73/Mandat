import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { zustandStorage } from '@/lib/storage';
import { fontFamilies } from '@/theme';
import { palettes } from '@/theme/colors';

type PerfOverlayState = { enabled: boolean; setEnabled: (enabled: boolean) => void };

/** Dev builds only: shows the JS and UI frame rates so lag can be reported with numbers. */
export const usePerfOverlay = create<PerfOverlayState>()(
  persist((set) => ({ enabled: false, setEnabled: (enabled) => set({ enabled }) }), {
    name: 'dev-perf-overlay',
    storage: createJSONStorage(() => zustandStorage),
  }),
);

/** Renders nothing in release builds or when the setting is off. */
export function PerfOverlay() {
  const enabled = usePerfOverlay((state) => state.enabled);
  if (!__DEV__ || !enabled) return null;
  return <PerfMeter />;
}

const SAMPLE_MS = 500;

function PerfMeter() {
  const insets = useSafeAreaInsets();
  const [fps, setFps] = useState({ js: 0, ui: 0 });
  const uiFrames = useSharedValue(0);
  const jsFrames = useRef(0);

  // UI thread: counts frames rendered by Reanimated.
  useFrameCallback(() => {
    uiFrames.set(uiFrames.get() + 1);
  });

  useEffect(() => {
    let frame = 0;
    const tick = () => {
      jsFrames.current += 1;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const interval = setInterval(() => {
      const scale = 1000 / SAMPLE_MS;
      setFps({ js: Math.round(jsFrames.current * scale), ui: Math.round(uiFrames.get() * scale) });
      jsFrames.current = 0;
      uiFrames.set(0);
    }, SAMPLE_MS);
    return () => {
      cancelAnimationFrame(frame);
      clearInterval(interval);
    };
  }, [uiFrames]);

  const color = (value: number) => (value >= 55 ? palettes.dark.success : value >= 40 ? palettes.dark.gold : palettes.dark.danger);

  return (
    <View pointerEvents="none" style={[styles.root, { top: insets.top + 4 }]}>
      <Text style={[styles.text, { color: color(fps.js) }]}>JS {fps.js}</Text>
      <Text style={[styles.text, { color: color(fps.ui) }]}>UI {fps.ui}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    position: 'absolute',
    right: 8,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.72)',
    zIndex: 9999,
  },
  text: { fontFamily: fontFamilies.bodyBold, fontSize: 12, fontVariant: ['tabular-nums'] },
});
