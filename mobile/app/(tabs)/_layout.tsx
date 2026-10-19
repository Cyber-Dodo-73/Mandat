import { Tabs } from 'expo-router/js-tabs';

import { TabBar } from '@/components/navigation/TabBar';
import { useTranslation } from '@/i18n';

export const unstable_settings = { anchor: 'index' };

export default function TabsLayout() {
  const { t } = useTranslation();
  // Declaration order is the bar order: the pack hub sits in the middle.
  return (
    <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="collection" options={{ title: t('tabs.collection') }} />
      <Tabs.Screen name="play" options={{ title: t('tabs.play') }} />
      <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
      <Tabs.Screen name="missions" options={{ title: t('tabs.missions') }} />
      <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
    </Tabs>
  );
}
