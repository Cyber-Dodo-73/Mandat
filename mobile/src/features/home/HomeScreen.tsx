import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import {
  Badge,
  Body,
  Caption,
  Card,
  EmptyState,
  Heading,
  Icon,
  PressableScale,
  ProgressBar,
  ScreenContainer,
  Text,
  Title,
} from '@/components/ui';
import { useTranslation } from '@/i18n';
import { spacing, useTheme } from '@/theme';

/** Placeholder values until progression comes from the API (phase 7). */
const PLACEHOLDER = { streak: 0, level: 1, xp: 0, xpForNext: 100 };

export function HomeScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <Title style={styles.flex}>{t('home.greeting')}</Title>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('settings.title')}
          hitSlop={12}
          onPress={() => router.push('/settings')}
        >
          <Icon name="settings-outline" size={26} tone="textMuted" />
        </PressableScale>
      </View>

      <Card raised>
        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Icon name="flame" size={28} tone="accent" />
            <View>
              <Caption>{t('home.streak.label')}</Caption>
              <Text variant="heading">{t('home.streak.days', { count: PLACEHOLDER.streak })}</Text>
            </View>
          </View>
          <Badge label={t('home.level.label', { level: PLACEHOLDER.level })} color={colors.accent} textColor={colors.onAccent} />
        </View>
        <ProgressBar
          progress={PLACEHOLDER.xp / PLACEHOLDER.xpForNext}
          accessibilityLabel={t('home.level.label', { level: PLACEHOLDER.level })}
        />
        <Caption>{t('home.level.xp', { current: PLACEHOLDER.xp, total: PLACEHOLDER.xpForNext })}</Caption>
      </Card>

      <Card>
        <Heading>{t('home.nextPack.title')}</Heading>
        <Text variant="display" tone="accent">
          {t('home.nextPack.pending')}
        </Text>
        <Body tone="muted">{t('home.nextPack.subtitle')}</Body>
      </Card>

      <Card>
        <Heading>{t('home.missions.title')}</Heading>
        <EmptyState icon="checkmark-done-outline" message={t('home.missions.empty')} />
      </Card>

      <Card>
        <Heading>{t('home.figureOfTheDay.title')}</Heading>
        <EmptyState icon="sparkles-outline" message={t('home.figureOfTheDay.empty')} />
      </Card>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  statsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stat: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
