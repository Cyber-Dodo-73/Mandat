import { StyleSheet, View } from 'react-native';

import { rarityRank, rarityStyles, type Rarity } from '@/theme/rarity';

type RarityPipsProps = {
  rarity: Rarity;
  /** Side of one diamond, in points. */
  size: number;
};

/** One to six small diamonds, like the rarity marks printed on trading cards. */
export function RarityPips({ rarity, size }: RarityPipsProps) {
  const { color, edge } = rarityStyles[rarity];
  const count = rarityRank(rarity) + 1;
  return (
    <View style={[styles.row, { gap: size * 0.45 }]}>
      {Array.from({ length: count }, (_, index) => (
        <View
          key={index}
          style={{
            width: size,
            height: size,
            backgroundColor: color,
            borderColor: edge,
            borderWidth: Math.max(0.5, size * 0.12),
            transform: [{ rotate: '45deg' }],
          }}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
});
