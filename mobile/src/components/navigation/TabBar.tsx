import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, PressableScale, Text, type IconName } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

const ICONS: Record<string, { active: IconName; idle: IconName }> = {
  index: { active: 'home', idle: 'home-outline' },
  collection: { active: 'albums', idle: 'albums-outline' },
  packs: { active: 'gift', idle: 'gift-outline' },
  play: { active: 'flash', idle: 'flash-outline' },
  profile: { active: 'person', idle: 'person-outline' },
};

export function TabBar({ state, descriptors, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View
      accessibilityRole="tablist"
      style={[
        styles.bar,
        {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key]?.options;
        const label = typeof options?.title === 'string' ? options.title : route.name;
        const icons = ICONS[route.name] ?? { active: 'ellipse', idle: 'ellipse-outline' };
        const color = focused ? colors.accent : colors.textMuted;

        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) {
            navigateToTab(route.key);
          }
        };

        return (
          <PressableScale
            key={route.key}
            accessibilityRole="tab"
            accessibilityLabel={label}
            accessibilityState={{ selected: focused }}
            onPress={onPress}
            pressedScale={0.88}
            containerStyle={styles.tabTarget}
            style={styles.tab}
          >
            <Icon name={focused ? icons.active : icons.idle} size={24} color={color} />
            <Text variant="caption" color={color} numberOfLines={1}>
              {label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: spacing.xs,
  },
  tabTarget: { flex: 1 },
  tab: { alignItems: 'center', gap: 2, paddingVertical: spacing.xxs },
});
