import type { ReactNode } from 'react';
import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { instant, springs } from '@/theme/motion';

type PressableScaleProps = Omit<PressableProps, 'style' | 'children'> & {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** Layout style of the touch target itself (e.g. flex: 1 in a row). */
  containerStyle?: StyleProp<ViewStyle>;
  /** Scale reached while pressed. */
  pressedScale?: number;
  haptic?: 'tap' | 'toggle' | 'none';
};

/** Base for every tappable element: spring scale on the UI thread + haptic. */
export function PressableScale({
  children,
  style,
  containerStyle,
  pressedScale = 0.95,
  haptic = 'tap',
  onPressIn,
  onPressOut,
  disabled,
  ...rest
}: PressableScaleProps) {
  const reduceMotion = useReduceMotion();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.get() }] }));

  const animateTo = (value: number) => {
    scale.set(reduceMotion ? withTiming(value, instant) : withSpring(value, springs.press));
  };

  return (
    <Pressable
      disabled={disabled}
      style={containerStyle}
      onPressIn={(event) => {
        if (!reduceMotion) animateTo(pressedScale);
        if (haptic !== 'none') haptics[haptic]();
        onPressIn?.(event);
      }}
      onPressOut={(event) => {
        animateTo(1);
        onPressOut?.(event);
      }}
      {...rest}
    >
      <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>
    </Pressable>
  );
}
