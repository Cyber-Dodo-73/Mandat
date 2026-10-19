import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Body, Button3D, Caption, Heading, Icon, Title, type IconName } from '@/components/ui';
import { usePacksQuery } from '@/features/packs/queries';
import { useNotificationPermission } from '@/features/progression/useNotificationSync';
import { useSettingsStore } from '@/features/settings/store';
import { useCountdown } from '@/hooks/useCountdown';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { formatCountdown, useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';

/**
 * End of the tour: what's next (free booster timer, streak, missions), then the notification
 * permission is asked HERE, once the player knows why reminders are useful.
 */
export function FinishStep({ onDone }: { onDone: () => void }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const packs = usePacksQuery();
  const { permission, request } = useNotificationPermission();
  const setNotificationsEnabled = useSettingsStore((state) => state.setNotificationsEnabled);
  const free = packs.data?.freePacks;
  const secondsLeft = useCountdown(free?.nextFreePackAt ?? null);
  const packReady = (free?.stock ?? 0) > 0;

  const enableReminders = async () => {
    const granted = (await request()) === 'granted';
    if (granted) {
      setNotificationsEnabled(true);
      haptics.missionComplete();
    }
    onDone();
  };

  const rows: { icon: IconName; color: string; text: string }[] = [
    {
      icon: 'gift',
      color: colors.accent,
      text: packReady || !free?.nextFreePackAt ? t('ftue.finish.packReady') : t('ftue.finish.nextPack', { time: formatCountdown(secondsLeft) }),
    },
    { icon: 'flame', color: '#FF9F1C', text: t('ftue.finish.streak') },
    { icon: 'checkmark-done-circle', color: colors.success, text: t('ftue.finish.missions') },
  ];
  const enter = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).springify().damping(13));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(250)}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
      accessibilityViewIsModal
    >
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.xl, paddingBottom: insets.bottom + spacing.lg }]}>
        <Animated.View entering={enter(0)} style={styles.hero}>
          <View style={[styles.trophy, { backgroundColor: colors.accent, borderBottomColor: colors.accentEdge }]}>
            <Icon name="trophy" size={52} tone="onAccent" />
          </View>
          <Title align="center" accessibilityRole="header">
            {t('ftue.finish.title')}
          </Title>
          <Body tone="muted" align="center">
            {t('ftue.finish.subtitle')}
          </Body>
        </Animated.View>

        <View style={styles.rows}>
          {rows.map((row, index) => (
            <Animated.View
              key={row.icon}
              entering={enter(100 + index * 90)}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border, borderBottomColor: colors.neutralButtonEdge }]}
            >
              <View style={[styles.rowIcon, { backgroundColor: `${row.color}26` }]}>
                <Icon name={row.icon} size={26} color={row.color} />
              </View>
              <Heading style={styles.rowText}>{row.text}</Heading>
            </Animated.View>
          ))}
        </View>

        <Animated.View entering={enter(420)} style={styles.footer}>
          {permission === 'undetermined' ? (
            <>
              <Heading align="center">{t('ftue.finish.notifTitle')}</Heading>
              <Caption tone="muted" align="center">
                {t('ftue.finish.notifBody')}
              </Caption>
              <Button3D label={t('ftue.finish.enable')} icon="notifications" size="lg" fullWidth onPress={() => void enableReminders()} />
              <Button3D label={t('ftue.finish.later')} variant="ghost" fullWidth onPress={onDone} />
            </>
          ) : (
            <Button3D label={t('ftue.finish.done')} icon="flash" size="lg" fullWidth onPress={onDone} />
          )}
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm },
  trophy: {
    width: 104,
    height: 104,
    borderRadius: 52,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xs,
  },
  rows: { gap: spacing.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius,
    borderWidth: 1,
    borderBottomWidth: 4,
  },
  rowIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1 },
  footer: { gap: spacing.sm },
});
