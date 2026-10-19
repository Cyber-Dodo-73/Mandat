import type { TextStyle } from 'react-native';

/** Bricolage Grotesque for titles and numbers (the wordmark font), Figtree for reading. */
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
  display: { fontFamily: fontFamilies.displayHeavy, fontSize: 40, lineHeight: 44, letterSpacing: -1 },
  title: { fontFamily: fontFamilies.displayHeavy, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  heading: { fontFamily: fontFamilies.displayBold, fontSize: 20, lineHeight: 25, letterSpacing: -0.2 },
  body: { fontFamily: fontFamilies.bodyRegular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamilies.bodySemiBold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fontFamilies.bodyBold, fontSize: 15, lineHeight: 20, letterSpacing: 0.2 },
  caption: { fontFamily: fontFamilies.bodyMedium, fontSize: 13, lineHeight: 17 },
};

/** Caps dynamic type growth so large titles keep fitting on small screens. */
export const maxFontScale: Record<TextVariant, number> = {
  display: 1.3,
  title: 1.4,
  heading: 1.6,
  body: 2,
  bodyStrong: 2,
  label: 1.4,
  caption: 2,
};
