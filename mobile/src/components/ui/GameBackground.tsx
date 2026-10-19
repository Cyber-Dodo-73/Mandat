import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet } from 'react-native';

import { useTheme } from '@/theme';

/**
 * Screen ground with depth: a soft light from the top fading into the base color,
 * so screens read as a lit game stage rather than a flat page.
 */
export function GameBackground() {
  const { colors } = useTheme();
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[colors.backgroundGlow, colors.background, colors.background]}
      locations={[0, 0.45, 1]}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={StyleSheet.absoluteFill}
    />
  );
}
