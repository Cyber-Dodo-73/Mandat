import { Canvas, Rect, RadialGradient } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BOOSTER_RATIO, useDeviceTilt } from '@/components/pack';
import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { Body, Button3D, Heading, PressableScale, Text } from '@/components/ui';
import { seasonNumber } from '@/data/catalog';
import { useFtueAnchor } from '@/features/ftue';
import { FreePackTimer } from '@/features/packs/FreePackTimer';
import { OddsSheet } from '@/features/packs/OddsSheet';
import { PackCarousel } from '@/features/packs/PackCarousel';
import { usePacksQuery } from '@/features/packs/queries';
import type { PackSummary } from '@/features/packs/types';
import { useProgressionQuery } from '@/features/player/queries';
import { FigureOfTheDay } from '@/features/progression/FigureOfTheDay';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { errorMessageKey } from '@/lib/api';
import { spacing, useTheme } from '@/theme';
import { packPalettes } from '@/theme/packs';

import { toHubProgress, TopBar } from './TopBar';

/** Pack hub: the app opens straight on the boosters, like a pack shelf. */
export function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const reduceMotion = useReduceMotion();
  const tilt = useDeviceTilt(!reduceMotion);
  const packs = usePacksQuery();
  const progression = useProgressionQuery();
  const online = useIsOnline();
  const [activeIndex, setActiveIndex] = useState(0);
  const [oddsVisible, setOddsVisible] = useState(false);
  const [stage, setStage] = useState({ width: 0, height: 0 });
  const openAnchor = useFtueAnchor('home.open');

  const packWidth = Math.round(Math.min(width * 0.56, (height * 0.4) / BOOSTER_RATIO, 240));
  const data = packs.data;
  const active = data?.packs[activeIndex];
  // Free stock first, then bonus boosters won as rewards: the server applies the same order.
  const packsLeft = (data?.freePacks.stock ?? 0) + (data?.bonusPacks ?? 0);
  const canOpen = Boolean(active?.unlocked) && packsLeft > 0 && online;

  const open = (pack: PackSummary) => {
    if (!pack.unlocked || packsLeft === 0 || !online) return;
    router.push({ pathname: '/pack-opening', params: { packId: pack.id, theme: pack.theme } });
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xs }]}>
      <TopBar progress={toHubProgress(progression.data)} />
      <FigureOfTheDay timeZone={progression.data?.timezone} />

      <View
        style={styles.stage}
        onLayout={(event) => setStage({ width: event.nativeEvent.layout.width, height: event.nativeEvent.layout.height })}
      >
        {active ? (
          <Animated.View key={active.theme} entering={FadeIn.duration(400)} style={StyleSheet.absoluteFill}>
            <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
              <Rect x={0} y={0} width={stage.width} height={stage.height}>
                <RadialGradient
                  c={{ x: stage.width / 2, y: stage.height / 2 }}
                  r={Math.max(stage.width, stage.height) * 0.55}
                  colors={[`${packPalettes[active.theme].glow}55`, `${packPalettes[active.theme].glow}00`]}
                />
              </Rect>
            </Canvas>
          </Animated.View>
        ) : null}

        {data ? (
          <PackCarousel
            packs={data.packs}
            season={seasonNumber}
            packWidth={packWidth}
            activeIndex={activeIndex}
            onActiveChange={setActiveIndex}
            onOpen={open}
            tilt={tilt}
          />
        ) : packs.isError ? (
          <View style={styles.centered}>
            <Body tone="muted" align="center">
              {t(errorMessageKey(packs.error))}
            </Body>
            <Button3D label={t('common.retry')} variant="secondary" onPress={() => void packs.refetch()} />
          </View>
        ) : (
          <ActivityIndicator color={colors.textMuted} />
        )}
      </View>

      {data && active ? (
        <View style={styles.panel}>
          <Heading align="center">{t(`packs.names.${active.theme}`)}</Heading>
          <FreePackTimer state={data.freePacks} />
          {data.bonusPacks > 0 ? <Body tone="muted">{t('packs.bonusPacks', { count: data.bonusPacks })}</Body> : null}
          {online ? null : <OfflineNotice />}
          <View style={styles.cta} ref={openAnchor}>
            <Button3D
              label={
                active.unlocked ? t('packs.openButton') : t('packs.lockedLevel', { level: active.unlockLevel ?? 0 })
              }
              icon={active.unlocked ? 'flash' : 'lock-closed'}
              size="lg"
              fullWidth
              disabled={!canOpen}
              accessibilityHint={t('packs.openHint')}
              onPress={() => open(active)}
            />
          </View>
          <PressableScale
            accessibilityRole="button"
            hitSlop={10}
            onPress={() => setOddsVisible(true)}
            style={styles.oddsLink}
          >
            <Text variant="caption" tone="muted" style={styles.underline}>
              {t('packs.oddsLink')}
            </Text>
          </PressableScale>
          <OddsSheet visible={oddsVisible} onClose={() => setOddsVisible(false)} packId={active.id} pity={data.pity} />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  stage: { flex: 1, justifyContent: 'center' },
  centered: { alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg },
  panel: { alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  cta: { alignSelf: 'stretch', paddingHorizontal: spacing.lg },
  oddsLink: { paddingVertical: spacing.xxs },
  underline: { textDecorationLine: 'underline' },
});
