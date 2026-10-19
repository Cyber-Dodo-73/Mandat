import { Tabs } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';

import { TabBar } from '@/components/navigation/TabBar';
import { ProgressionHost } from '@/features/progression/ProgressionHost';
import { useTranslation } from '@/i18n';

export const unstable_settings = { anchor: 'index' };

export default function TabsLayout() {
  const { t } = useTranslation();
  // Declaration order is the bar order: the pack hub sits in the middle.
  return (
    <View style={styles.root}>
      <Tabs tabBar={(props) => <TabBar {...props} />} screenOptions={{ headerShown: false }}>
        <Tabs.Screen name="collection" options={{ title: t('tabs.collection') }} />
        <Tabs.Screen name="play" options={{ title: t('tabs.play') }} />
        <Tabs.Screen name="index" options={{ title: t('tabs.home') }} />
        <Tabs.Screen name="missions" options={{ title: t('tabs.missions') }} />
        <Tabs.Screen name="profile" options={{ title: t('tabs.profile') }} />
      </Tabs>
      {/* Celebrations, return recap and reminders: signed-in screens only. */}
      <ProgressionHost />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
