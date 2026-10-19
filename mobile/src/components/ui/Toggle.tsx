import { useEffect } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useReduceMotion } from '@/hooks/useReduceMotion';
import { haptics } from '@/lib/haptics';
import { radius, useTheme } from '@/theme';
import { instant, springs } from '@/theme/motion';

const TRACK_WIDTH = 52;
const TRACK_HEIGHT = 32;
const KNOB = 24;
const INSET = (TRACK_HEIGHT - KNOB) / 2;
const TRAVEL = TRACK_WIDTH - KNOB - INSET * 2;

type ToggleProps = {
  value: boolean;
  onValueChange: (value: boolean) => void;
  accessibilityLabel: string;
  disabled?: boolean;
};

export function Toggle({ value, onValueChange, accessibilityLabel, disabled = false }: ToggleProps) {
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const position = useSharedValue(value ? 1 : 0);

  useEffect(() => {
    position.set(reduceMotion ? withTiming(value ? 1 : 0, instant) : withSpring(value ? 1 : 0, springs.bounce));
  }, [position, reduceMotion, value]);

  const trackStyle = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(position.get(), [0, 1], [colors.surfaceRaised, colors.accent]),
  }));
  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: position.get() * TRAVEL }] }));

  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: value, disabled }}
      disabled={disabled}
      hitSlop={8}
      onPress={() => {
        haptics.toggle();
        onValueChange(!value);
      }}
    >
      <Animated.View style={[styles.track, { borderColor: colors.border }, trackStyle]}>
        <Animated.View style={[styles.knob, { backgroundColor: colors.text }, knobStyle]} />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  track: {
    width: TRACK_WIDTH,
    height: TRACK_HEIGHT,
    borderRadius: radius,
    borderWidth: 1,
    justifyContent: 'center',
    paddingHorizontal: INSET - 1,
  },
  knob: { width: KNOB, height: KNOB, borderRadius: radius },
});
