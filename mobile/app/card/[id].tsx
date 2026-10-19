import { PlaceholderScreen } from '@/components/navigation/PlaceholderScreen';
import { useTranslation } from '@/i18n';

export default function CardDetailRoute() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('card.title')} message={t('card.placeholder')} icon="albums-outline" dismiss="close" />;
}
