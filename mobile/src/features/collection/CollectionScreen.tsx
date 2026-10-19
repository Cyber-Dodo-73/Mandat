import { Caption, Card, EmptyState, ProgressBar, ScreenContainer, Title } from '@/components/ui';
import { formatPercent, useLanguage, useTranslation } from '@/i18n';

export function CollectionScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const completion = 0;

  return (
    <ScreenContainer>
      <Title>{t('collection.title')}</Title>
      <Card>
        <Caption>{t('collection.subtitle')}</Caption>
        <ProgressBar progress={completion} accessibilityLabel={t('collection.subtitle')} />
        <Caption>{formatPercent(completion, language)}</Caption>
      </Card>
      <EmptyState icon="albums-outline" message={t('collection.empty')} />
    </ScreenContainer>
  );
}
