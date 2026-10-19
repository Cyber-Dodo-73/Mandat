import { Canvas, Circle, Group, ImageSVG, rect, rrect, Skia, type SkSVG } from '@shopify/react-native-skia';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { FLAG_SVGS } from '@/data/flags.generated';
import type { Continent } from '@/types/card';

type FlagChipProps = {
  country: string;
  continent: Continent;
  height: number;
};

const FLAG_RATIO = 1.5;
const parsed = new Map<string, SkSVG | null>();

/** Parses each flag once for the whole app (cards are rendered many times). */
function flagSvg(country: string): SkSVG | null {
  const code = country.toUpperCase();
  if (!parsed.has(code)) {
    const source = FLAG_SVGS[code];
    parsed.set(code, source ? Skia.SVG.MakeFromString(source) : null);
  }
  return parsed.get(code) ?? null;
}

/**
 * The real flag of the figure's country (country-flag-icons, bundled offline), rendered natively
 * at its target size. Countries without a modern flag get a neutral emblem.
 */
export const FlagChip = memo(function FlagChip({ country, height }: FlagChipProps) {
  const width = height * FLAG_RATIO;
  const svg = flagSvg(country);
  const radius = height * 0.18;
  const clip = useMemo(() => rrect(rect(0, 0, width, height), radius, radius), [width, height, radius]);
  return (
    <View style={[styles.chip, { width, height, borderRadius: radius }]}>
      <Canvas style={{ width, height }} pointerEvents="none">
        <Group clip={clip}>
          {svg ? (
            <ImageSVG svg={svg} x={0} y={0} width={width} height={height} />
          ) : (
            <>
              <Group>
                <Circle cx={width / 2} cy={height / 2} r={height * 0.32} color="#C9CFDF" />
              </Group>
              <Circle cx={width / 2} cy={height / 2} r={height * 0.18} color="#5B6489" />
            </>
          )}
        </Group>
      </Canvas>
    </View>
  );
});

const styles = StyleSheet.create({
  chip: { overflow: 'hidden', backgroundColor: '#2A3260', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(255,255,255,0.35)' },
});
