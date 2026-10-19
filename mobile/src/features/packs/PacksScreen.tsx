import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button3D, Caption, Card, Icon, ScreenContainer, Sheet, Title } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { radius, spacing, useTheme } from '@/theme';

export function PacksScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const [oddsVisible, setOddsVisible] = useState(false);

  return (
    <ScreenContainer>
      <Title>{t('packs.title')}</Title>
      <Card raised style={styles.packCard}>
        <View style={[styles.packArt, { backgroundColor: colors.surfaceRaised, borderColor: colors.accent }]}>
          <Icon name="gift" size={56} tone="accent" />
        </View>
        <Caption align="center">{t('packs.subtitle')}</Caption>
        <Button3D
          label={t('packs.openButton')}
          size="lg"
          icon="flash"
          fullWidth
          onPress={() => router.push('/pack-opening')}
        />
        <Button3D
          label={t('packs.oddsButton')}
          variant="secondary"
          icon="stats-chart"
          fullWidth
          onPress={() => setOddsVisible(true)}
        />
      </Card>

      <Sheet visible={oddsVisible} onClose={() => setOddsVisible(false)} title={t('packs.oddsButton')}>
        <Body tone="muted">{t('common.comingSoon')}</Body>
        <Button3D label={t('common.close')} variant="secondary" fullWidth onPress={() => setOddsVisible(false)} />
      </Sheet>
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  packCard: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.lg },
  packArt: {
    width: 160,
    height: 220,
    borderRadius: radius,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
