import type { BottomTabBarProps } from 'expo-router/js-tabs';
import { useEffect } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Emblem } from '@/components/brand';
import { Icon, Text, type IconName } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { buttonDepth, radius, spacing, useTheme } from '@/theme';
import { instant, springs } from '@/theme/motion';

const ICONS: Record<string, { active: IconName; idle: IconName }> = {
  collection: { active: 'albums', idle: 'albums-outline' },
  play: { active: 'flash', idle: 'flash-outline' },
  index: { active: 'gift', idle: 'gift' },
  missions: { active: 'checkmark-done-circle', idle: 'checkmark-done-circle-outline' },
  profile: { active: 'person', idle: 'person-outline' },
};

/** The pack hub is the centre button, raised above the bar like a game console's main action. */
const HUB_ROUTE = 'index';
const HUB_SIZE = 62;
const INDICATOR_WIDTH = 28;

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
          borderTopColor: colors.hairline,
          paddingBottom: Math.max(insets.bottom, spacing.xs),
        },
      ]}
    >
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const options = descriptors[route.key]?.options;
        const label = typeof options?.title === 'string' ? options.title : route.name;
        const onPress = () => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        };
        const icons = ICONS[route.name] ?? { active: 'ellipse', idle: 'ellipse-outline' };
        return route.name === HUB_ROUTE ? (
          <HubTab key={route.key} label={label} icon={icons.active} focused={focused} onPress={onPress} />
        ) : (
          <TabItem
            key={route.key}
            label={label}
            icon={focused ? icons.active : icons.idle}
            focused={focused}
            onPress={onPress}
          />
        );
      })}
    </View>
  );
}

type TabProps = { label: string; icon: IconName; focused: boolean; onPress: () => void };

function useFocusProgress(focused: boolean) {
  const reduceMotion = useReduceMotion();
  const progress = useSharedValue(focused ? 1 : 0);
  useEffect(() => {
    progress.set(reduceMotion ? withTiming(focused ? 1 : 0, instant) : withSpring(focused ? 1 : 0, springs.bounce));
  }, [focused, progress, reduceMotion]);
  return progress;
}

function TabItem({ label, icon, focused, onPress }: TabProps) {
  const { colors } = useTheme();
  const progress = useFocusProgress(focused);
  const press = useSharedValue(1);
  const color = focused ? colors.goldBright : colors.textMuted;

  const iconStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * progress.get() }, { scale: (1 + 0.12 * progress.get()) * press.get() }],
  }));
  const indicatorStyle = useAnimatedStyle(() => ({
    opacity: progress.get(),
    transform: [{ scaleX: progress.get() }],
  }));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPressIn={() => {
        press.set(withSpring(0.86, springs.press));
        haptics.toggle();
      }}
      onPressOut={() => press.set(withSpring(1, springs.press))}
      onPress={onPress}
      style={styles.tab}
    >
      <Animated.View style={[styles.indicator, { backgroundColor: colors.gold }, indicatorStyle]} />
      <Animated.View style={iconStyle}>
        <Icon name={icon} size={25} color={color} />
      </Animated.View>
      <Text variant="caption" color={color} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function HubTab({ label, focused, onPress }: TabProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const sink = useSharedValue(0);
  const progress = useFocusProgress(focused);

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sink.get() }] }));
  const ringStyle = useAnimatedStyle(() => ({ opacity: progress.get(), transform: [{ scale: 0.9 + 0.1 * progress.get() }] }));
  const sinkTo = (value: number) => sink.set(reduceMotion ? withTiming(value, instant) : withSpring(value, springs.press));

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected: focused }}
      onPressIn={() => {
        sinkTo(buttonDepth);
        haptics.tap();
      }}
      onPressOut={() => sinkTo(0)}
      onPress={onPress}
      style={styles.tab}
    >
      <View style={styles.hubWrap}>
        <Animated.View style={[styles.hubRing, { borderColor: colors.goldBright }, ringStyle]} />
        <View style={[styles.hubEdge, { backgroundColor: colors.accentEdge }]} />
        {/* The pack hub is the brand's wax seal, pressed into the bar. */}
        <Animated.View
          style={[styles.hubFace, { backgroundColor: colors.accent, borderColor: colors.goldBright }, faceStyle]}
        >
          <Emblem size={HUB_SIZE - 4} />
        </Animated.View>
      </View>
      <Text variant="caption" color={focused ? colors.goldBright : colors.textMuted} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderTopWidth: StyleSheet.hairlineWidth * 2,
    paddingTop: spacing.xs,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing.xxs },
  indicator: {
    position: 'absolute',
    top: -spacing.xs - 1,
    width: INDICATOR_WIDTH,
    height: 4,
    borderBottomLeftRadius: radius,
    borderBottomRightRadius: radius,
  },
  hubWrap: { width: HUB_SIZE, height: HUB_SIZE + buttonDepth, marginTop: -HUB_SIZE / 2 },
  hubRing: {
    position: 'absolute',
    top: -5,
    left: -5,
    width: HUB_SIZE + 10,
    height: HUB_SIZE + 10,
    borderRadius: (HUB_SIZE + 10) / 2,
    borderWidth: 3,
  },
  hubEdge: { position: 'absolute', top: buttonDepth, width: HUB_SIZE, height: HUB_SIZE, borderRadius: HUB_SIZE / 2 },
  hubFace: {
    width: HUB_SIZE,
    height: HUB_SIZE,
    borderRadius: HUB_SIZE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
});
