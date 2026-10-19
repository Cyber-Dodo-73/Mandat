import type { TextStyle } from 'react-native';

/** Nunito everywhere: rounded, heavy and friendly, like a mobile game HUD. */
export const fontFamilies = {
  displayBold: 'Nunito_800ExtraBold',
  displayHeavy: 'Nunito_900Black',
  bodyRegular: 'Nunito_600SemiBold',
  bodyMedium: 'Nunito_700Bold',
  bodySemiBold: 'Nunito_700Bold',
  bodyBold: 'Nunito_800ExtraBold',
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
  display: { fontFamily: fontFamilies.displayHeavy, fontSize: 40, lineHeight: 44, letterSpacing: -0.5 },
  title: { fontFamily: fontFamilies.displayHeavy, fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  heading: { fontFamily: fontFamilies.displayBold, fontSize: 20, lineHeight: 25 },
  body: { fontFamily: fontFamilies.bodyRegular, fontSize: 16, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamilies.bodySemiBold, fontSize: 16, lineHeight: 22 },
  label: { fontFamily: fontFamilies.bodyBold, fontSize: 16, lineHeight: 20, letterSpacing: 0.3 },
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
