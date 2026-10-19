import { StyleSheet, View } from 'react-native';

import { Badge, Body, Card, Heading, Icon, ScreenContainer, Title, type IconName } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { spacing } from '@/theme';

type Mode = { key: 'quiz' | 'duel'; icon: IconName };

const MODES: readonly Mode[] = [
  { key: 'quiz', icon: 'help-circle' },
  { key: 'duel', icon: 'shield-half' },
];

export function PlayScreen() {
  const { t } = useTranslation();

  return (
    <ScreenContainer>
      <Title>{t('play.title')}</Title>
      {MODES.map((mode) => (
        <Card key={mode.key} raised>
          <View style={styles.row}>
            <Icon name={mode.icon} size={32} tone="accent" />
            <View style={styles.texts}>
              <Heading>{t(`play.${mode.key}.title`)}</Heading>
              <Body tone="muted">{t(`play.${mode.key}.description`)}</Body>
            </View>
          </View>
          <Badge label={t('common.comingSoon')} />
        </Card>
      ))}
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' },
  texts: { flex: 1, gap: spacing.xxs },
});
