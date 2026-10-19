import { forwardRef, useState, type ComponentRef } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';

import { fontFamilies, maxFontScale, radius, spacing, textVariants, useTheme } from '@/theme';

import { Caption, Text } from './Text';

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  label: string;
  /** Helper shown under the field while there is no error. */
  hint?: string;
  error?: string | null;
};

/** Labelled input: the border turns accent on focus and danger on error. */
export const TextField = forwardRef<ComponentRef<typeof TextInput>, TextFieldProps>(function TextField(
  { label, hint, error, onFocus, onBlur, ...input },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error ? colors.danger : focused ? colors.accent : colors.border;

  return (
    <View style={styles.root}>
      <Text variant="label">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        accessibilityHint={error ?? hint}
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.accent}
        maxFontSizeMultiplier={maxFontScale.body}
        {...input}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        style={[styles.input, { color: colors.text, backgroundColor: colors.surface, borderColor }]}
      />
      {error ? (
        <Caption tone="danger" accessibilityLiveRegion="polite">
          {error}
        </Caption>
      ) : hint ? (
        <Caption>{hint}</Caption>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { gap: spacing.xxs },
  input: {
    ...textVariants.body,
    fontFamily: fontFamilies.bodyMedium,
    minHeight: 52,
    borderWidth: 2,
    borderRadius: radius / 2,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
});
