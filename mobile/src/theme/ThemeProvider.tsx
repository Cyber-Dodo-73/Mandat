import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { useSettingsStore } from '@/features/settings/store';

import { palettes, type ColorScheme, type ThemeColors } from './colors';

export type Theme = {
  scheme: ColorScheme;
  colors: ThemeColors;
};

const ThemeContext = createContext<Theme>({ scheme: 'dark', colors: palettes.dark });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const preference = useSettingsStore((state) => state.theme);
  const systemScheme = useColorScheme();
  const scheme: ColorScheme =
    preference === 'system' ? (systemScheme === 'light' ? 'light' : 'dark') : preference;

  const value = useMemo<Theme>(() => ({ scheme, colors: palettes[scheme] }), [scheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): Theme {
  return useContext(ThemeContext);
}
