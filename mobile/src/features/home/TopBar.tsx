import { Canvas, Circle, Path, Skia } from '@shopify/react-native-skia';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CosmeticEmblem } from '@/components/profile/CosmeticEmblem';
import { Icon, PressableScale, Text } from '@/components/ui';
import type { Progression } from '@/features/player/queries';
import { DEFAULT_AVATAR } from '@/features/profile/cosmetics';
import { useMyProfileQuery } from '@/features/profile/queries';
import { StreakFlame } from '@/features/progression/StreakFlame';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { fontFamilies, spacing, useTheme } from '@/theme';

/** What the hub shows of the player's progress (from `GET /progression`). */
export type HubProgress = {
  level: number;
  xp: number;
  xpForNextLevel: number;
  streakDays: number;
  /** Today's streak activity (booster or quiz) is done. */
  streakActiveToday: boolean;
  /** This week's free streak freeze is still available. */
  freezeAvailable: boolean;
  influence: number;
};

export function toHubProgress(progression: Progression | undefined): HubProgress {
  if (!progression) {
    return { level: 1, xp: 0, xpForNextLevel: 1, streakDays: 0, streakActiveToday: false, freezeAvailable: false, influence: 0 };
  }
  return {
    level: progression.level,
    xp: progression.xpIntoLevel,
    // Max level: the ring stays full.
    xpForNextLevel: progression.xpForNextLevel ?? Math.max(1, progression.xpIntoLevel),
    streakDays: progression.currentStreak,
    streakActiveToday: progression.streakActiveToday,
    freezeAvailable: progression.freezeAvailable,
    influence: progression.influence,
  };
}

const AVATAR = 44;
const RING_WIDTH = 4;
const PILL_HEIGHT = 38;
const PILL_DEPTH = 1;

type TopBarProps = { progress: HubProgress };

/** Game HUD: avatar with its XP ring and level badge, streak and Influence counters, settings. */
export function TopBar({ progress }: TopBarProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const profile = useMyProfileQuery();
  const avatarId = profile.data?.profile.avatarId ?? DEFAULT_AVATAR;
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
        <LevelRing ratio={ratio} track={colors.surfaceRaised} fill={colors.brand} />
        <View style={styles.avatar}>
          <CosmeticEmblem kind="avatar" id={avatarId} size={AVATAR} />
        </View>
        <View style={[styles.levelBadge, { backgroundColor: colors.brand, borderColor: colors.background }]}>
          <Text allowFontScaling={false} style={[styles.levelText, { color: colors.onBrand }]}>
            {t('home.topBar.level', { level: progress.level })}
          </Text>
        </View>
      </PressableScale>

      <StreakPill progress={progress} />
      <HudPill
        label={t('home.topBar.influenceA11y', { amount: progress.influence })}
        icon={<Icon name="ribbon" size={20} color={colors.gold} />}
        value={formatNumber(progress.influence, language)}
      />

      <View style={styles.spacer} />

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('home.topBar.settings')}
        hitSlop={10}
        onPress={() => router.push('/settings')}
        style={[styles.iconButton, { backgroundColor: colors.surfaceRaised, borderBottomColor: colors.neutralButtonEdge }]}
      >
        <Icon name="settings-sharp" size={22} tone="textMuted" />
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

/** One counter: the flame grows with the streak and glows once today is done; the freeze is a corner badge. */
function StreakPill({ progress }: { progress: HubProgress }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const label = [
    t('home.topBar.streakA11y', { count: progress.streakDays }),
    progress.streakActiveToday ? t('streak.doneToday') : t('streak.pendingToday'),
    progress.freezeAvailable ? t('streak.freezeAvailable') : null,
  ]
    .filter(Boolean)
    .join('. ');
  return (
    <HudPill
      label={label}
      glow={progress.streakActiveToday ? colors.flame : undefined}
      icon={<StreakFlame streak={progress.streakDays} activeToday={progress.streakActiveToday} base={18} />}
      value={formatNumber(progress.streakDays, language)}
      corner={
        progress.freezeAvailable ? (
          <View style={[styles.corner, { backgroundColor: colors.brand, borderColor: colors.background }]}>
            <Icon name="snow" size={10} color={colors.onBrand} />
          </View>
        ) : null
      }
    />
  );
}

type HudPillProps = {
  label: string;
  icon: React.ReactNode;
  value: string;
  /** Colored rim when the counter is "on" (e.g. streak done today). */
  glow?: string;
  corner?: React.ReactNode;
};

function HudPill({ label, icon, value, glow, corner }: HudPillProps) {
  const { colors } = useTheme();
  return (
    <View
      accessible
      accessibilityLabel={label}
      style={[
        styles.pill,
        {
          backgroundColor: colors.surfaceRaised,
          borderBottomColor: colors.neutralButtonEdge,
          borderColor: glow ?? 'transparent',
        },
      ]}
    >
      {icon}
      <Text allowFontScaling={false} style={[styles.pillValue, { color: colors.text }]}>
        {value}
      </Text>
      {corner}
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
    overflow: 'hidden',
  },
  levelBadge: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    minWidth: 26,
    paddingHorizontal: 6,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
  },
  levelText: { fontFamily: fontFamilies.displayHeavy, fontSize: 12, lineHeight: 16 },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: PILL_HEIGHT,
    paddingHorizontal: spacing.sm,
    borderRadius: PILL_HEIGHT / 2,
    borderWidth: 1,
    borderBottomWidth: PILL_DEPTH,
  },
  pillValue: { fontFamily: fontFamilies.displayHeavy, fontSize: 18, lineHeight: 22 },
  corner: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderBottomWidth: PILL_DEPTH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  spacer: { flex: 1 },
});
