import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Icon, PressableScale, Text } from '@/components/ui';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { fontFamilies, radius, spacing, useTheme } from '@/theme';

import type { Progression } from '@/features/player/queries';

/** What the hub shows of the player's progress (from `GET /progression`). */
export type HubProgress = {
  level: number;
  xp: number;
  xpForNextLevel: number;
  streakDays: number;
  influence: number;
};

export function toHubProgress(progression: Progression | undefined): HubProgress {
  if (!progression) return { level: 1, xp: 0, xpForNextLevel: 1, streakDays: 0, influence: 0 };
  return {
    level: progression.level,
    xp: progression.xpIntoLevel,
    // Max level: the ring stays full.
    xpForNextLevel: progression.xpForNextLevel ?? Math.max(1, progression.xpIntoLevel),
    streakDays: progression.currentStreak,
    influence: progression.influence,
  };
}

const AVATAR = 46;
const RING_WIDTH = 4;

type TopBarProps = { progress: HubProgress };

/** Compact game HUD: level ring around the avatar, streak, Influence, settings. */
export function TopBar({ progress }: TopBarProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const ratio = Math.min(1, progress.xp / Math.max(1, progress.xpForNextLevel));

  return (
    <View style={styles.bar}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('home.topBar.levelA11y', {
          level: progress.level,
          current: progress.xp,
          total: progress.xpForNextLevel,
        })}
        onPress={() => router.navigate('/profile')}
      >
        <LevelRing ratio={ratio} track={colors.surfaceRaised} fill={colors.accent} />
        <View style={[styles.avatar, { backgroundColor: colors.surface }]}>
          <Icon name="person" size={22} tone="textMuted" />
        </View>
        <View style={[styles.levelPill, { backgroundColor: colors.accent }]}>
          <Text allowFontScaling={false} style={[styles.levelText, { color: colors.onAccent }]}>
            {t('home.topBar.level', { level: progress.level })}
          </Text>
        </View>
      </PressableScale>

      <Stat
        icon="flame"
        iconColor={colors.accent}
        value={formatNumber(progress.streakDays, language)}
        label={t('home.topBar.streakA11y', { count: progress.streakDays })}
      />
      <Stat
        icon="ribbon"
        iconColor={colors.text}
        value={formatNumber(progress.influence, language)}
        label={t('home.topBar.influenceA11y', { amount: progress.influence })}
      />

      <View style={styles.spacer} />

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('home.topBar.settings')}
        hitSlop={12}
        onPress={() => router.push('/settings')}
      >
        <Icon name="settings-sharp" size={24} tone="textMuted" />
      </PressableScale>
    </View>
  );
}

function LevelRing({ ratio, track, fill }: { ratio: number; track: string; fill: string }) {
  const size = AVATAR + RING_WIDTH * 2;
  const center = size / 2;
  const r = center - RING_WIDTH / 2;
  const arc = useMemo(
    () => Skia.PathBuilder.Make().addArc(Skia.XYWHRect(center - r, center - r, r * 2, r * 2), -90, 359.9).detach(),
    [center, r],
  );
  return (
    <Canvas style={{ width: size, height: size }}>
      <Circle cx={center} cy={center} r={r} style="stroke" strokeWidth={RING_WIDTH} color={track} />
      <Path path={arc} style="stroke" strokeWidth={RING_WIDTH} strokeCap="round" color={fill} end={ratio} />
    </Canvas>
  );
}

type StatProps = { icon: 'flame' | 'ribbon'; iconColor: string; value: string; label: string };

function Stat({ icon, iconColor, value, label }: StatProps) {
  const { colors } = useTheme();
  return (
    <View accessible accessibilityLabel={label} style={[styles.stat, { backgroundColor: colors.surface }]}>
      <Icon name={icon} size={18} color={iconColor} />
      <Text variant="label" allowFontScaling={false}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingHorizontal: spacing.md },
  avatar: {
    position: 'absolute',
    top: RING_WIDTH,
    left: RING_WIDTH,
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelPill: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    minWidth: 24,
    paddingHorizontal: 6,
    borderRadius: radius,
    alignItems: 'center',
  },
  levelText: { fontFamily: fontFamilies.bodyBold, fontSize: 12, lineHeight: 16 },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    height: 36,
    borderRadius: radius,
  },
  spacer: { flex: 1 },
});
