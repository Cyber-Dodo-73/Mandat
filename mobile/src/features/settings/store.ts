import { getLocales } from 'expo-localization';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { resolveDeviceLanguage, type Language } from '@/i18n/languages';
import { zustandStorage } from '@/lib/storage';

export type ThemePreference = 'system' | 'dark' | 'light';

export type SettingsState = {
  language: Language;
  theme: ThemePreference;
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  notificationsEnabled: boolean;
  /** null follows the OS "reduce motion" setting. */
  reduceMotion: boolean | null;
  /** The three-screen intro is shown once, before the auth welcome screen. */
  onboardingSeen: boolean;
};

type SettingsActions = {
  setLanguage: (language: Language) => void;
  setTheme: (theme: ThemePreference) => void;
  setSoundEnabled: (enabled: boolean) => void;
  setHapticsEnabled: (enabled: boolean) => void;
  setNotificationsEnabled: (enabled: boolean) => void;
  setReduceMotion: (reduceMotion: boolean | null) => void;
  completeOnboarding: () => void;
};

function detectLanguage(): Language {
  return resolveDeviceLanguage(getLocales().map((locale) => locale.languageCode));
}

export const useSettingsStore = create<SettingsState & SettingsActions>()(
  persist(
    (set) => ({
      // Only used on first launch; the persisted value wins afterwards.
      language: detectLanguage(),
      theme: 'dark',
      soundEnabled: true,
      hapticsEnabled: true,
      notificationsEnabled: true,
      reduceMotion: null,
      onboardingSeen: false,
      setLanguage: (language) => set({ language }),
      setTheme: (theme) => set({ theme }),
      setSoundEnabled: (soundEnabled) => set({ soundEnabled }),
      setHapticsEnabled: (hapticsEnabled) => set({ hapticsEnabled }),
      setNotificationsEnabled: (notificationsEnabled) => set({ notificationsEnabled }),
      setReduceMotion: (reduceMotion) => set({ reduceMotion }),
      completeOnboarding: () => set({ onboardingSeen: true }),
    }),
    {
      name: 'settings',
      // v2: dark is the brand default; installs that never chose a theme (still on the old
      // 'system' default) move to dark. An explicit choice made later is kept.
      version: 2,
      migrate: (persisted, version) => {
        const state = persisted as Partial<SettingsState>;
        if (version < 2 && state.theme === 'system') return { ...state, theme: 'dark' };
        return state;
      },
      storage: createJSONStorage(() => zustandStorage),
      partialize: ({ language, theme, soundEnabled, hapticsEnabled, notificationsEnabled, reduceMotion, onboardingSeen }) => ({
        language,
        theme,
        soundEnabled,
        hapticsEnabled,
        notificationsEnabled,
        reduceMotion,
        onboardingSeen,
      }),
    },
  ),
);
