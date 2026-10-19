import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppProviders } from '@/components/navigation/AppProviders';
import { initI18n } from '@/i18n';
import { initSounds } from '@/lib/sounds';
import { useTheme } from '@/theme';
import { appFonts } from '@/theme/fonts';

initI18n();
void SplashScreen.preventAutoHideAsync();

function RootStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="card/[id]" options={{ presentation: 'modal' }} />
        <Stack.Screen name="pack-opening" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
        <Stack.Screen name="user/[id]" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    void initSounds().catch(() => undefined);
  }, []);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) return null;

  return (
    <AppProviders>
      <RootStack />
    </AppProviders>
  );
}
