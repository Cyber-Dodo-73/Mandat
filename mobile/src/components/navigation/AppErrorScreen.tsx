import type { ErrorBoundaryProps } from 'expo-router';
import { t } from 'i18next';
import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { recordCrash } from '@/lib/crashJournal';
import { wrapErrorBoundary } from '@/lib/monitoring';
import { palettes } from '@/theme/colors';
import { fontFamilies } from '@/theme/typography';

/**
 * Last line of defence: a render error anywhere in the app lands here instead of a blank restart.
 * Built on bare React Native primitives, so it works even when the providers themselves broke.
 */
function ErrorScreen({ error, retry }: ErrorBoundaryProps) {
  useEffect(() => {
    recordCrash(error, 'render');
  }, [error]);
  const colors = palettes.dark;
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>{t('errors.crash.title')}</Text>
      <Text style={[styles.body, { color: colors.textMuted }]}>{t('errors.crash.body')}</Text>
      <Pressable
        accessibilityRole="button"
        onPress={() => void retry()}
        style={({ pressed }) => [styles.button, { backgroundColor: colors.brand, opacity: pressed ? 0.85 : 1 }]}
      >
        <Text style={[styles.buttonLabel, { color: colors.onBrand }]}>{t('errors.crash.retry')}</Text>
      </Pressable>
      {__DEV__ ? (
        <Text style={[styles.detail, { color: colors.danger }]} selectable>
          {String(error?.message ?? error)}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 16 },
  title: { fontFamily: fontFamilies.displayHeavy, fontSize: 24, textAlign: 'center' },
  body: { fontFamily: fontFamilies.bodyRegular, fontSize: 16, textAlign: 'center', lineHeight: 22 },
  button: { marginTop: 8, paddingHorizontal: 28, paddingVertical: 14, borderRadius: 999 },
  buttonLabel: { fontFamily: fontFamilies.bodyBold, fontSize: 16 },
  detail: { fontFamily: fontFamilies.bodyRegular, fontSize: 12, marginTop: 16 },
});

/** Route error boundary: shows the recovery screen and reports the error with its route. */
export const AppErrorScreen = wrapErrorBoundary(ErrorScreen);
