import { Card, EmptyState, Heading, ScreenContainer, Title } from '@/components/ui';
import { useTranslation } from '@/i18n';

/** Placeholder until missions come from the API (phase 7). */
export function MissionsScreen() {
  const { t } = useTranslation();
  return (
    <ScreenContainer>
      <Title>{t('missions.title')}</Title>
      <Card>
        <Heading>{t('missions.daily')}</Heading>
        <EmptyState icon="checkmark-done-outline" message={t('missions.empty')} />
      </Card>
      <Card>
        <Heading>{t('missions.weekly')}</Heading>
        <EmptyState icon="calendar-outline" message={t('missions.empty')} />
      </Card>
    </ScreenContainer>
  );
}
