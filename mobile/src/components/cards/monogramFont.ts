import { Skia, type SkFont, type SkTypeface } from '@shopify/react-native-skia';
import { useEffect, useMemo, useState } from 'react';
import { Image } from 'react-native';

const FONT_SOURCE = require('@expo-google-fonts/nunito/900Black/Nunito_900Black.ttf');

let typeface: SkTypeface | null = null;
let loading: Promise<SkTypeface | null> | null = null;

/** Loads the display typeface once for every card, instead of once per card instance. */
function loadTypeface(): Promise<SkTypeface | null> {
  if (typeface) return Promise.resolve(typeface);
  const uri = Image.resolveAssetSource(FONT_SOURCE)?.uri;
  if (!uri) return Promise.resolve(null);
  loading ??= Skia.Data.fromURI(uri)
    .then((data) => {
      typeface = Skia.Typeface.MakeFreeTypeFaceFromData(data);
      return typeface;
    })
    .catch(() => null);
  return loading;
}

/** Bricolage Grotesque ExtraBold at `size`, or null while the typeface loads. */
export function useMonogramFont(size: number): SkFont | null {
  const [face, setFace] = useState<SkTypeface | null>(typeface);
  useEffect(() => {
    if (face) return;
    let active = true;
    void loadTypeface().then((loaded) => {
      if (active) setFace(loaded);
    });
    return () => {
      active = false;
    };
  }, [face]);
  return useMemo(() => (face ? Skia.Font(face, size) : null), [face, size]);
}
