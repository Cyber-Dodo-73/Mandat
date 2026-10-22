import { useFonts } from 'expo-font';
import { Stack, usePathname } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { AppErrorScreen } from '@/components/navigation/AppErrorScreen';
import { AppProviders } from '@/components/navigation/AppProviders';
import { useSessionStore } from '@/features/auth/session';
import { initI18n } from '@/i18n';
import { installCrashJournal, setCurrentScreen } from '@/lib/crashJournal';
import { initMonitoring, wrapRoot } from '@/lib/monitoring';
import { initSounds } from '@/lib/sounds';
import { useTheme } from '@/theme';
import { appFonts } from '@/theme/fonts';
import { PerfOverlay } from '@/features/dev/PerfOverlay';

initI18n();
// First thing: every JS error from here on is reported and journaled before the app goes down.
initMonitoring();
installCrashJournal();

void SplashScreen.preventAutoHideAsync();

/** Any render error below the root lands on a recoverable screen instead of a silent restart. */
export const ErrorBoundary = AppErrorScreen;

function RootStack() {
  const { scheme, colors } = useTheme();
  const pathname = usePathname();
  useEffect(() => {
    setCurrentScreen(pathname);
  }, [pathname]);
  const signedIn = useSessionStore((state) => state.status === 'signedIn');
  return (
    <>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="card/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="pack-opening" options={{ presentation: 'fullScreenModal', animation: 'fade' }} />
          <Stack.Screen name="user/[id]" />
          <Stack.Screen name="friends" />
          <Stack.Screen name="streak" />
          <Stack.Screen name="friend/[code]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="credits" />
          <Stack.Screen name="quiz/index" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="duel/index" />
          <Stack.Screen name="duel/[id]" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
          <Stack.Screen name="dev/cards" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
      <PerfOverlay />
    </>
  );
}

function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(appFonts);
  const sessionKnown = useSessionStore((state) => state.status !== 'loading');
  // The splash stays up until fonts are in and we know whether a session exists.
  const ready = (fontsLoaded || fontError !== null) && sessionKnown;

  useEffect(() => {
    void useSessionStore.getState().bootstrap();
  }, []);

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

export default wrapRoot(RootLayout);
