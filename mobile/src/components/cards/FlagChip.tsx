import { StyleSheet, View } from 'react-native';

import type { Continent } from '@/types/card';

import { flagPalette } from './flagColors';

type FlagChipProps = {
  country: string;
  continent: Continent;
  height: number;
};

/** Flag colors as plain stripes: never an emblem or symbol. */
export function FlagChip({ country, continent, height }: FlagChipProps) {
  const { stripes } = flagPalette(country, continent);
  return (
    <View style={[styles.chip, { height, width: height * 1.5, borderRadius: height * 0.2 }]}>
      {stripes.slice(0, 4).map((color, index) => (
        <View key={`${color}-${index}`} style={[styles.stripe, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { flexDirection: 'row', overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: 'rgba(244,241,234,0.4)' },
  stripe: { flex: 1 },
});
