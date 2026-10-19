import { StyleSheet, View } from 'react-native';

import { Body, Button3D, Icon, Sheet, Text, type IconName } from '@/components/ui';
import { usePacksQuery } from '@/features/packs/queries';
import { useProgressionQuery } from '@/features/player/queries';
import { useTranslation } from '@/i18n';
import { spacing } from '@/theme';

import { useMissionsQuery } from './queries';

/** "Welcome back" recap after a few days away: what is waiting, straight from the server. */
export function ReturnRecapSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const packs = usePacksQuery().data;
  const progression = useProgressionQuery().data;
  const missions = useMissionsQuery().data;

  const packsWaiting = (packs?.freePacks.stock ?? 0) + (packs?.bonusPacks ?? 0);
  const openMissions = [...(missions?.daily ?? []), ...(missions?.weekly ?? [])].filter((mission) => !mission.claimed).length;
  const streak = progression?.currentStreak ?? 0;

  return (
    <Sheet visible={visible} onClose={onClose} title={t('progression.return.title')}>
      <Body tone="muted">{t('progression.return.subtitle')}</Body>
      <View style={styles.list}>
        <Line icon="gift" text={t('progression.return.packs', { count: packsWaiting })} />
        <Line
          icon="flame"
          text={
            streak > 0
              ? t('progression.return.streakKept', { count: streak })
              : t('progression.return.streakLost', { best: progression?.bestStreak ?? 0 })
          }
        />
        <Line icon="checkmark-done" text={t('progression.return.missions', { count: openMissions })} />
      </View>
      <Button3D label={t('progression.return.cta')} onPress={onClose} fullWidth />
    </Sheet>
  );
}

function Line({ icon, text }: { icon: IconName; text: string }) {
  return (
    <View style={styles.line}>
      <Icon name={icon} size={22} tone="accent" />
      <Text variant="bodyStrong" style={styles.flex}>
        {text}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  list: { gap: spacing.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
