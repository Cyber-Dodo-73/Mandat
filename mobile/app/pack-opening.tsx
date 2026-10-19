import { PlaceholderScreen } from '@/components/navigation/PlaceholderScreen';
import { useTranslation } from '@/i18n';

export default function PackOpeningRoute() {
  const { t } = useTranslation();
  return (
    <PlaceholderScreen
      title={t('packOpening.title')}
      message={t('packOpening.placeholder')}
      icon="gift-outline"
      dismiss="close"
    />
  );
}
