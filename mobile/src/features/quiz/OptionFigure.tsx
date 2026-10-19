import { Image, type ImageSource } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui';
import { monogram } from '@/features/collection/cardText';
import { getCard } from '@/data/catalog';
import { portraits } from '@/data/portraits';
import { useLanguage } from '@/i18n';
import { rarityStyles, useTheme } from '@/theme';

import type { QuizOption } from './api';

const SIZE = 40;

/**
 * Small round portrait next to a figure option. Sensitive figures and cards without a
 * photo get a monogram instead, never a flattering picture.
 */
export function OptionFigure({ option }: { option: QuizOption }) {
  const { colors } = useTheme();
  const language = useLanguage();
  const card = option.cardId ? getCard(option.cardId) : undefined;
  if (!card) return null;
  const portrait = portraits[card.id];
  const ring = rarityStyles[card.rarity].color;
  return (
    <View style={[styles.frame, { borderColor: ring, backgroundColor: colors.surface }]}>
      {portrait ? (
        <Image source={portrait as ImageSource} style={styles.image} contentFit="cover" contentPosition="top" />
      ) : (
        <Text variant="label" tone="muted">
          {monogram(card.name[language] || card.name.fr)}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  frame: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    borderWidth: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: { width: '100%', height: '100%' },
});
