import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets, type Edge } from 'react-native-safe-area-context';

import { spacing, useTheme } from '@/theme';

type ScreenContainerProps = {
  children: ReactNode;
  scroll?: boolean;
  /**
   * Screen edges to pad with the safe-area insets. Tabs already handle the bottom inset
   * through the tab bar, and sheet modals ("modal" presentation) start below the status bar.
   */
  edges?: readonly Edge[];
  contentStyle?: StyleProp<ViewStyle>;
};

export function ScreenContainer({ children, scroll = true, edges = ['top'], contentStyle }: ScreenContainerProps) {
  const { colors } = useTheme();
  // Insets come from the root provider: the native SafeAreaView reports no inset inside
  // full-screen modals, which put headers under the status bar.
  const insets = useSafeAreaInsets();
  const insetStyle = {
    paddingTop: edges.includes('top') ? insets.top : 0,
    paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
    paddingLeft: edges.includes('left') ? insets.left : 0,
    paddingRight: edges.includes('right') ? insets.right : 0,
  };
  return (
    <View style={[styles.root, insetStyle, { backgroundColor: colors.background }]}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[styles.content, contentStyle]}
          showsVerticalScrollIndicator={false}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, styles.fill, contentStyle]}>{children}</View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  fill: { flex: 1 },
  content: { padding: spacing.md, paddingBottom: spacing.xxl, gap: spacing.lg },
});
