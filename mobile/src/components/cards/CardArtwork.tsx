import {
  Canvas,
  ColorMatrix,
  Fill,
  Group,
  LinearGradient,
  Path,
  RadialGradient,
  Text as SkiaText,
  vec,
} from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';

import { portraits } from '@/data/portraits';
import { monogram as monogramOf } from '@/features/collection/cardText';
import type { Card } from '@/types/card';

import { eraMotifPath, engravingPaths, guillochePath } from './engraving';
import { flagPalette } from './flagColors';
import { useMonogramFont } from './monogramFont';
import { PortraitArtwork } from './PortraitArtwork';

/** Desaturates and darkens sensitive cards: sober, no heroic color. */
const SOBER_MATRIX = [
  0.21, 0.62, 0.07, 0, -0.04,
  0.21, 0.62, 0.07, 0, -0.04,
  0.21, 0.62, 0.07, 0, -0.03,
  0, 0, 0, 1, 0,
];

/** Gold prints: luminance remapped onto a warm metallic ramp. */
const GOLD_MATRIX = [
  0.39, 0.77, 0.19, 0, 0.06,
  0.32, 0.64, 0.15, 0, 0.02,
  0.16, 0.32, 0.08, 0, -0.03,
  0, 0, 0, 1, 0,
];

/** Sensitive gold prints: a dull, desaturated brass instead of bright gold. */
const SOBER_GOLD_MATRIX = [
  0.27, 0.53, 0.1, 0, -0.03,
  0.24, 0.47, 0.09, 0, -0.04,
  0.17, 0.34, 0.07, 0, -0.05,
  0, 0, 0, 1, 0,
];

const PAPER = '#F4F1EA';
const INK = '#0B0F1A';

type CardArtworkProps = {
  card: Card;
  /** Display name, used for the monogram initials. */
  name: string;
  width: number;
  height: number;
  /** Full art prints: composition made for the whole card, bigger monogram, richer motif. */
  fullBleed?: boolean;
  /** Gold prints: gold-tinted artwork. */
  gold?: boolean;
  /** Large cards: engraved overlay on top of a portrait (thumbs stay a plain image). */
  engraved?: boolean;
};

function colorMatrixFor(sensitive: boolean, gold: boolean): number[] | null {
  if (gold) return sensitive ? SOBER_GOLD_MATRIX : GOLD_MATRIX;
  return sensitive ? SOBER_MATRIX : null;
}

/**
 * Card illustration: the bundled portrait when the card has one, otherwise the procedural
 * stand-in (flag-colored gradient, banknote guilloché, era frieze, engraved monogram).
 */
export const CardArtwork = memo(function CardArtwork(props: CardArtworkProps) {
  const source = portraits[props.card.id];
  if (source) {
    const { card, width, height, fullBleed, gold, engraved } = props;
    return (
      <PortraitArtwork
        card={card}
        source={source}
        width={width}
        height={height}
        fullBleed={fullBleed}
        gold={gold}
        engraved={engraved}
      />
    );
  }
  return <ProceduralArtwork {...props} />;
});

const ProceduralArtwork = memo(function ProceduralArtwork({ card, name, width, height, fullBleed = false, gold = false }: CardArtworkProps) {
  const palette = flagPalette(card.country, card.continent);
  const paths = engravingPaths(card.era, width, height);
  const extra = useMemo(() => {
    if (!fullBleed) return null;
    // Full bleed: a second, larger rosette and the era frieze repeated at the top.
    const band = Math.max(6, Math.round(height * 0.06));
    return {
      rosette: guillochePath(width * 0.3, height * 0.2, Math.max(width, height) * 0.55, 24, 2),
      topMotif: eraMotifPath(card.era, width, height * 0.04, band),
    };
  }, [fullBleed, width, height, card.era]);

  const initials = useMemo(() => monogramOf(name), [name]);
  const share = fullBleed ? 0.42 : initials.length > 1 ? 0.56 : 0.66;
  const fontSize = Math.round(height * share);
  const font = useMonogramFont(fontSize);
  const strokeWidth = Math.max(0.5, width / 260);
  const baseline = height * (fullBleed ? 0.58 : 0.78);

  const textX = useMemo(() => {
    if (!font) return 0;
    const textWidth = font.measureText(initials).width;
    return fullBleed ? (width - textWidth) / 2 : Math.max(width * 0.06, (width - textWidth) * 0.18);
  }, [font, initials, width, fullBleed]);

  const matrix = colorMatrixFor(card.sensitive, gold);

  return (
    <Canvas style={{ width, height }} pointerEvents="none">
      <Group layer={matrix ? <ColorMatrix matrix={matrix} /> : undefined}>
        <Fill>
          <LinearGradient
            start={vec(0, 0)}
            end={vec(width, height)}
            colors={[palette.primary, palette.secondary]}
          />
        </Fill>
        {/* Light falloff so the monogram and the white text keep their contrast. */}
        <Fill>
          <RadialGradient
            c={vec(width * (fullBleed ? 0.5 : 0.7), height * 0.25)}
            r={Math.max(width, height)}
            colors={['rgba(11,15,26,0.05)', 'rgba(11,15,26,0.62)']}
          />
        </Fill>
        {extra ? (
          <>
            <Path path={extra.rosette} style="stroke" strokeWidth={strokeWidth} color={PAPER} opacity={0.12} />
            <Path path={extra.topMotif} style="stroke" strokeWidth={strokeWidth * 1.4} color={PAPER} opacity={0.38} />
          </>
        ) : null}
        <Path path={paths.rosette} style="stroke" strokeWidth={strokeWidth} color={PAPER} opacity={0.2} />
        <Path path={paths.motif} style="stroke" strokeWidth={strokeWidth * 1.4} color={PAPER} opacity={0.42} />
        {font ? (
          <Group>
            <SkiaText
              x={textX + fontSize * 0.04}
              y={baseline + fontSize * 0.04}
              text={initials}
              font={font}
              color={INK}
              opacity={0.45}
            />
            <SkiaText x={textX} y={baseline} text={initials} font={font} color={PAPER} opacity={0.94} />
            <SkiaText
              x={textX}
              y={baseline}
              text={initials}
              font={font}
              style="stroke"
              strokeWidth={strokeWidth * 1.2}
              color={palette.primary}
              opacity={0.5}
            />
          </Group>
        ) : null}
      </Group>
    </Canvas>
  );
});
