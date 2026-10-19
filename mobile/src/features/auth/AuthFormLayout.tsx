import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { Body } from '@/components/ui';
import { spacing, useTheme } from '@/theme';

type AuthFormLayoutProps = { title: string; intro: string; children: ReactNode; footer: ReactNode };

/** Form screens of the sign-in flow: fields scroll above the keyboard, the action stays reachable. */
export function AuthFormLayout({ title, intro, children, footer }: AuthFormLayoutProps) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}
    >
      <ScrollView
        contentContainerStyle={styles.content}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader title={title} />
        <Body tone="muted">{intro}</Body>
        <View style={styles.fields}>{children}</View>
      </ScrollView>
      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>{footer}</View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: spacing.md, gap: spacing.lg },
  fields: { gap: spacing.md },
  footer: { paddingHorizontal: spacing.md, gap: spacing.sm },
});
