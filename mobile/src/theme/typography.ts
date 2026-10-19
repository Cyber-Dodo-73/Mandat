import type { TextStyle } from 'react-native';

export const fontFamilies = {
  displayBold: 'BricolageGrotesque_700Bold',
  displayHeavy: 'BricolageGrotesque_800ExtraBold',
  bodyRegular: 'Figtree_400Regular',
  bodyMedium: 'Figtree_500Medium',
  bodySemiBold: 'Figtree_600SemiBold',
  bodyBold: 'Figtree_700Bold',
} as const;

export type TextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'body'
  | 'bodyStrong'
  | 'label'
  | 'caption';

type VariantStyle = Pick<TextStyle, 'fontFamily' | 'fontSize' | 'lineHeight' | 'letterSpacing'>;

export const textVariants: Record<TextVariant, VariantStyle> = {
  display: { fontFamily: fontFamilies.displayHeavy, fontSize: 36, lineHeight: 40, letterSpacing: -0.8 },
  title: { fontFamily: fontFamilies.displayHeavy, fontSize: 28, lineHeight: 32, letterSpacing: -0.5 },
  heading: { fontFamily: fontFamilies.displayBold, fontSize: 20, lineHeight: 26, letterSpacing: -0.2 },
  body: { fontFamily: fontFamilies.bodyRegular, fontSize: 16, lineHeight: 23 },
  bodyStrong: { fontFamily: fontFamilies.bodySemiBold, fontSize: 16, lineHeight: 23 },
  label: { fontFamily: fontFamilies.bodyBold, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
  caption: { fontFamily: fontFamilies.bodyMedium, fontSize: 13, lineHeight: 18 },
};

/** Caps dynamic type growth so large titles keep fitting on small screens. */
export const maxFontScale: Record<TextVariant, number> = {
  display: 1.3,
  title: 1.4,
  heading: 1.6,
  body: 2,
  bodyStrong: 2,
  label: 1.6,
  caption: 2,
};
