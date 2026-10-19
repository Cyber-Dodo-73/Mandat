import { Canvas, Circle, RadialGradient, vec } from '@shopify/react-native-skia';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { Icon, Text } from '@/components/ui';
import { useCountdown } from '@/hooks/useCountdown';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { formatCountdown, formatDate, formatNumber, useLanguage, useTranslation } from '@/i18n';
import { StreakFlame } from '@/features/progression/StreakFlame';
import { fontFamilies, radius, spacing, useTheme } from '@/theme';
import { springs } from '@/theme/motion';

import type { StreakView } from './api';
import type { CalendarDay } from './calendar';
import { dayTone, streakPalette } from './palette';

const GLOW = 220;

/** Top of the streak screen: the big flame, the day count, today's status and the week. */
export function StreakHero({ streak, week }: { streak: StreakView; week: CalendarDay[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const secondsLeft = useCountdown(streak.activeToday ? null : streak.dayEndsAt);
  const lit = streak.current > 0 && streak.activeToday;

  const pop = useSharedValue(reduceMotion ? 1 : 0.6);
  const glow = useSharedValue(1);
  useEffect(() => {
    if (reduceMotion) {
      pop.set(1);
      glow.set(1);
      return;
    }
    pop.set(withDelay(80, withSpring(1, springs.bounce)));
    glow.set(lit ? withRepeat(withSequence(withTiming(1.12, { duration: 900 }), withTiming(0.94, { duration: 900 })), -1, true) : 1);
  }, [glow, lit, pop, reduceMotion]);

  const popStyle = useAnimatedStyle(() => ({ transform: [{ scale: pop.get() }] }));
  const glowStyle = useAnimatedStyle(() => ({ transform: [{ scale: glow.get() }] }));

  const gradient: [string, string] = lit ? [streakPalette.flame, colors.accentEdge] : [colors.surfaceRaised, colors.background];
  const ink = lit ? streakPalette.onFlame : colors.text;

  return (
    <LinearGradient colors={gradient} style={[styles.hero, { borderColor: lit ? streakPalette.flameHot : colors.border }]}>
      <View style={styles.flameStage}>
        <Animated.View style={[styles.glow, glowStyle]} pointerEvents="none">
          <Canvas style={styles.glowCanvas}>
            <Circle cx={GLOW / 2} cy={GLOW / 2} r={GLOW / 2}>
              <RadialGradient
                c={vec(GLOW / 2, GLOW / 2)}
                r={GLOW / 2}
                colors={lit ? ['rgba(255, 214, 102, 0.85)', 'rgba(255, 122, 26, 0)'] : ['rgba(255, 255, 255, 0.10)', 'rgba(255, 255, 255, 0)']}
              />
            </Circle>
          </Canvas>
        </Animated.View>
        <Animated.View style={popStyle}>
          <StreakFlame streak={streak.current} activeToday={streak.activeToday} base={120} />
        </Animated.View>
      </View>

      <Animated.View style={[styles.count, popStyle]}>
        <Text allowFontScaling={false} color={ink} style={styles.number}>
          {formatNumber(streak.current, language)}
        </Text>
        <Text variant="heading" color={ink}>
          {t('streak.days', { count: streak.current })}
        </Text>
      </Animated.View>

      <View style={[styles.statusPill, { backgroundColor: lit ? 'rgba(26, 10, 2, 0.22)' : colors.surface }]}>
        <Icon name={streak.activeToday ? 'checkmark-circle' : 'time'} size={18} color={lit ? streakPalette.onFlame : streakPalette.flame} />
        <Text variant="label" color={ink}>
          {streak.activeToday
            ? t('streak.hero.done')
            : streak.current > 0
              ? t('streak.hero.atRisk', { time: formatCountdown(secondsLeft) })
              : t('streak.hero.start')}
        </Text>
      </View>

      <Text variant="caption" color={lit ? streakPalette.onFlame : colors.textMuted}>
        {t('streak.hero.best', { count: streak.best })}
      </Text>

      <View style={styles.week} accessibilityRole="summary">
        {week.map((day) => (
          <WeekDay key={day.date} day={day} label={formatDate(new Date(`${day.date}T12:00:00Z`), language, { weekday: 'narrow', timeZone: 'UTC' })} />
        ))}
      </View>
    </LinearGradient>
  );
}

function WeekDay({ day, label }: { day: CalendarDay; label: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const tone = dayTone(day.status, colors);
  const icon = day.status === 'active' ? 'flame' : day.status === 'frozen' ? 'snow' : day.status === 'missed' ? 'close' : null;
  return (
    <View style={styles.weekDay} accessible accessibilityLabel={`${label} · ${t(`streak.status.${day.status}`)}`}>
      <Text variant="caption" style={styles.weekLabel} color={colors.text}>
        {label}
      </Text>
      <View style={[styles.bubble, { backgroundColor: tone.edge }]}>
        <View
          style={[
            styles.bubbleFace,
            { backgroundColor: tone.fill, borderColor: tone.border ?? 'transparent', borderWidth: tone.border ? 3 : 0 },
          ]}
        >
          {icon ? <Icon name={icon} size={18} color={tone.label} /> : null}
        </View>
      </View>
    </View>
  );
}

const BUBBLE = 38;

const styles = StyleSheet.create({
  hero: {
    alignItems: 'center',
    gap: spacing.xs,
    borderRadius: radius,
    borderWidth: 3,
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    overflow: 'hidden',
  },
  flameStage: { width: GLOW, height: 150, alignItems: 'center', justifyContent: 'center' },
  glow: { position: 'absolute', width: GLOW, height: GLOW, top: -35 },
  glowCanvas: { width: GLOW, height: GLOW },
  count: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs },
  number: { fontFamily: fontFamilies.displayHeavy, fontSize: 72, lineHeight: 78, letterSpacing: -2 },
  statusPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs + 2,
    borderRadius: radius,
  },
  week: { flexDirection: 'row', justifyContent: 'space-between', alignSelf: 'stretch', marginTop: spacing.sm },
  weekDay: { alignItems: 'center', gap: spacing.xxs },
  weekLabel: { fontFamily: fontFamilies.bodyBold, textTransform: 'uppercase' },
  bubble: { width: BUBBLE, height: BUBBLE + 4, borderRadius: BUBBLE / 2 },
  bubbleFace: {
    width: BUBBLE,
    height: BUBBLE,
    borderRadius: BUBBLE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
