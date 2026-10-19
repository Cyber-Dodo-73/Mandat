import { Caption, SettingRow, Toggle, type IconName } from '@/components/ui';
import { useTranslation } from '@/i18n';

import { PUSH_CATEGORIES, usePushPreferencesQuery, useUpdatePushPreference, type PushCategory } from './pushApi';

const ICONS: Record<PushCategory, IconName> = {
  boosterReady: 'gift-outline',
  nudges: 'hand-left-outline',
  streak: 'flame-outline',
  friends: 'people-outline',
  events: 'ribbon-outline',
  marketing: 'megaphone-outline',
};

/** Per-category server push opt-ins (marketing stays off until the player turns it on). */
export function NotificationPreferences() {
  const { t } = useTranslation();
  const preferences = usePushPreferencesQuery().data;
  const update = useUpdatePushPreference();

  if (!preferences) return null;
  return (
    <>
      <Caption>{t('settings.notifications.categoriesTitle')}</Caption>
      {PUSH_CATEGORIES.map((category) => (
        <SettingRow
          key={category}
          icon={ICONS[category]}
          label={t(`settings.notifications.categories.${category}`)}
          hint={category === 'marketing' ? t('settings.notifications.marketingHint') : undefined}
          control={
            <Toggle
              accessibilityLabel={t(`settings.notifications.categories.${category}`)}
              value={preferences[category]}
              onValueChange={(value) => update.mutate({ [category]: value })}
            />
          }
        />
      ))}
    </>
  );
}
