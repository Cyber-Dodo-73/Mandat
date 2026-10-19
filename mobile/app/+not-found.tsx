import { router } from 'expo-router';

import { Button3D, EmptyState, ScreenContainer, Title } from '@/components/ui';
import { useTranslation } from '@/i18n';

export default function NotFoundRoute() {
  const { t } = useTranslation();
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <Title>{t('notFound.title')}</Title>
      <EmptyState icon="compass-outline" message={t('notFound.title')} />
      <Button3D label={t('notFound.action')} fullWidth onPress={() => router.replace('/')} />
    </ScreenContainer>
  );
}
