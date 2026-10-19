import { Text as RNText, StyleSheet, type TextProps as RNTextProps } from 'react-native';

import { maxFontScale, textVariants, useTheme, type TextVariant, type ThemeColors } from '@/theme';

export type TextTone = 'default' | 'muted' | 'accent' | 'onAccent' | 'success' | 'danger';

const TONE_COLOR: Record<TextTone, keyof ThemeColors> = {
  default: 'text',
  muted: 'textMuted',
  accent: 'accent',
  onAccent: 'onAccent',
  success: 'success',
  danger: 'danger',
};

export type TextProps = RNTextProps & {
  variant?: TextVariant;
  tone?: TextTone;
  /** Overrides the tone with an explicit color (e.g. rarity colors). */
  color?: string;
  align?: 'left' | 'center' | 'right';
};

export function Text({ variant = 'body', tone = 'default', color, align, style, ...rest }: TextProps) {
  const { colors } = useTheme();
  return (
    <RNText
      maxFontSizeMultiplier={maxFontScale[variant]}
      {...rest}
      style={[
        textVariants[variant],
        { color: color ?? colors[TONE_COLOR[tone]] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}

type AliasProps = Omit<TextProps, 'variant'>;

export const Title = (props: AliasProps) => (
  <Text accessibilityRole="header" variant="title" {...props} />
);
export const Heading = (props: AliasProps) => (
  <Text accessibilityRole="header" variant="heading" {...props} />
);
export const Body = (props: AliasProps) => <Text variant="body" {...props} />;
export const Caption = (props: AliasProps) => <Text variant="caption" tone="muted" {...props} />;

export const textStyles = StyleSheet.create({
  uppercase: { textTransform: 'uppercase' },
});
