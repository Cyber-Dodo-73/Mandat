import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Card, EmptyState, Heading, Icon, PressableScale, ScreenContainer, Title } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { spacing, useTheme } from '@/theme';

export function ProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();

  return (
    <ScreenContainer>
      <View style={styles.header}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceRaised, borderColor: colors.accent }]}>
          <Icon name="person" size={36} tone="textMuted" />
        </View>
        <Title style={styles.flex}>{t('profile.title')}</Title>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('profile.settingsButton')}
          hitSlop={12}
          onPress={() => router.push('/settings')}
        >
          <Icon name="settings-outline" size={26} tone="textMuted" />
        </PressableScale>
      </View>
      <Card>
        <Heading>{t('profile.showcase.title')}</Heading>
        <EmptyState icon="images-outline" message={t('profile.showcase.empty')} />
      </Card>
    </ScreenContainer>
  );
}

const AVATAR = 64;

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
