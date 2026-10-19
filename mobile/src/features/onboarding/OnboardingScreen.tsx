import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { FlatList, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Emblem } from '@/components/brand';
import { Body, Button3D, PressableScale, Text } from '@/components/ui';
import { useSettingsStore } from '@/features/settings/store';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { spacing, useTheme } from '@/theme';

import { ONBOARDING_PAGES, type OnboardingPage } from './pages';

/** Art is 1080×1350 (4:5). */
const ART_RATIO = 1350 / 1080;

/** Three-screen intro shown once before the auth welcome: collect, learn, duel. */
export function OnboardingScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const completeOnboarding = useSettingsStore((state) => state.completeOnboarding);
  const list = useRef<FlatList<OnboardingPage>>(null);
  const [index, setIndex] = useState(0);
  const last = index === ONBOARDING_PAGES.length - 1;
  // The art takes what the copy and buttons leave, never more than its natural ratio.
  const artWidth = Math.min(width - spacing.lg * 2, (height * 0.48) / ART_RATIO);

  const finish = () => {
    completeOnboarding();
    router.replace('/welcome');
  };

  const next = () => {
    haptics.tap();
    if (last) {
      finish();
      return;
    }
    list.current?.scrollToIndex({ index: index + 1, animated: true });
    setIndex(index + 1);
  };


  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }]}>
      <View style={styles.top}>
        <Emblem size={36} />
        {last ? null : (
          <PressableScale accessibilityRole="button" hitSlop={12} onPress={finish}>
            <Text variant="label" tone="muted">
              {t('onboarding.skip')}
            </Text>
          </PressableScale>
        )}
      </View>

      <FlatList
        ref={list}
        data={ONBOARDING_PAGES}
        keyExtractor={(page) => page.id}
        horizontal
        pagingEnabled
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(event) => setIndex(Math.round(event.nativeEvent.contentOffset.x / width))}
        getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
        renderItem={({ item }) => (
          <View style={[styles.page, { width }]}>
            <Image
              source={item.image}
              style={{ width: artWidth, height: artWidth * ART_RATIO }}
              contentFit="contain"
              accessible={false}
            />
            <View style={styles.copy}>
              <Text variant="title" align="center" accessibilityRole="header">
                {t(`onboarding.pages.${item.id}.title`)}
              </Text>
              <Body tone="muted" align="center">
                {t(`onboarding.pages.${item.id}.body`)}
              </Body>
            </View>
          </View>
        )}
      />

      <View style={styles.footer}>
        <View style={styles.dots} accessibilityLabel={t('onboarding.progress', { current: index + 1, total: ONBOARDING_PAGES.length })}>
          {ONBOARDING_PAGES.map((page, i) => (
            <View
              key={page.id}
              style={[styles.dot, { backgroundColor: i === index ? colors.goldBright : colors.hairline, width: i === index ? 22 : 8 }]}
            />
          ))}
        </View>
        <Button3D label={last ? t('onboarding.start') : t('onboarding.next')} size="lg" fullWidth onPress={next} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    minHeight: 56,
  },
  page: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg },
  copy: { gap: spacing.xs, maxWidth: 360 },
  footer: { gap: spacing.md, paddingHorizontal: spacing.lg },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: spacing.xs },
  dot: { height: 8, borderRadius: 4 },
});
