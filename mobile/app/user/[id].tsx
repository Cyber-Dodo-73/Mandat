import { PlaceholderScreen } from '@/components/navigation/PlaceholderScreen';
import { useTranslation } from '@/i18n';

export default function UserProfileRoute() {
  const { t } = useTranslation();
  return <PlaceholderScreen title={t('user.title')} message={t('user.placeholder')} icon="person-outline" />;
}
