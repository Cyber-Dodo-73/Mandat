import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { availableFinishes, CardBack, CardReveal, CardSilhouette, TradingCard, type CardSize } from '@/components/cards';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import {
  Button3D,
  Card as Surface,
  ScreenContainer,
  SectionHeader,
  SegmentedControl,
  SettingRow,
  Toggle,
  type SegmentOption,
} from '@/components/ui';
import { firstSensitiveCard, sampleCards } from '@/data/catalog';
import { useTranslation } from '@/i18n';
import { spacing, useTheme } from '@/theme';
import { CARD_FINISHES, type Card, type CardFinish } from '@/types/card';

type Reveal = { card: Card; finish: CardFinish };

/** Dev-only preview of every rarity × finish, the card variants and every reveal sequence. */
export function CardGalleryScreen() {
  const { t } = useTranslation();
  const samples = sampleCards();
  const sensitive = firstSensitiveCard();
  const cards = sensitive ? [...samples.map((sample) => sample.card), sensitive] : samples.map((sample) => sample.card);
  const [revealing, setRevealing] = useState<Reveal | null>(null);
  const [revealFinish, setRevealFinish] = useState<CardFinish>('standard');
  const [firstTime, setFirstTime] = useState(false);
  const [round, setRound] = useState(0);

  const finishOptions: SegmentOption<CardFinish>[] = CARD_FINISHES.map((finish) => ({
    value: finish,
    label: t(`cards.finish.${finish}`),
  }));
  const [readSize, setReadSize] = useState<CardSize>('large');
  const [readFinish, setReadFinish] = useState<CardFinish>('holo');
  const sizeOptions: SegmentOption<CardSize>[] = (['thumb', 'grid', 'large', 'hero'] as const).map((size) => ({
    value: size,
    label: t(`cards.size.${size}`),
  }));

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <ScreenHeader title={t('dev.cards.title')} />

      {/* Readability check: every rarity at one size and finish, text must stay crisp over any foil. */}
      <SectionHeader title={t('cards.readability')} />
      <Surface>
        <SegmentedControl accessibilityLabel={t('cards.readability')} options={sizeOptions} value={readSize} onChange={setReadSize} />
        <SegmentedControl
          accessibilityLabel={t('dev.cards.finishes')}
          options={finishOptions}
          value={readFinish}
          onChange={setReadFinish}
        />
      </Surface>
      <View style={styles.grid}>
        {cards.map((card) => (
          <TradingCard key={`read-${card.id}`} card={card} finish={readFinish} size={readSize} />
        ))}
      </View>

      {CARD_FINISHES.map((finish) => (
        <View key={finish} style={styles.section}>
          <SectionHeader title={t(`cards.finish.${finish}`)} />
          <View style={styles.grid}>
            {cards
              .filter((card) => availableFinishes(card.rarity).includes(finish))
              .map((card) => (
                <Pressable
                  key={card.id}
                  accessibilityRole="button"
                  onPress={() => router.push({ pathname: '/card/[id]', params: { id: card.id, finish } })}
                >
                  <TradingCard card={card} finish={finish} size="grid" />
                </Pressable>
              ))}
          </View>
        </View>
      ))}

      <View style={styles.row}>
        {samples[5] ? <TradingCard card={samples[5].card} finish="gold" size="large" width={160} /> : null}
        <CardBack size="large" width={160} />
        <CardBack size="large" width={160} finish="gold" />
      </View>
      <View style={styles.row}>
        <CardSilhouette number={42} size="large" width={160} />
        {samples[4] ? <TradingCard card={samples[4].card} finish="full_art" size="large" width={160} /> : null}
      </View>

      <SectionHeader title={t('dev.cards.reveals')} />
      <Surface>
        <SegmentedControl
          accessibilityLabel={t('dev.cards.finishes')}
          options={finishOptions}
          value={revealFinish}
          onChange={setRevealFinish}
        />
        <SettingRow
          icon="lock-closed-outline"
          label={t('dev.cards.firstTime')}
          control={<Toggle accessibilityLabel={t('dev.cards.firstTime')} value={firstTime} onValueChange={setFirstTime} />}
        />
        {cards.map((card) => (
          <Button3D
            key={card.id}
            label={card.sensitive ? t('dev.cards.sensitive') : t(`rarity.${card.rarity}`)}
            variant={card.sensitive ? 'secondary' : 'primary'}
            size="sm"
            fullWidth
            disabled={!availableFinishes(card.rarity).includes(revealFinish)}
            onPress={() => {
              setRound((value) => value + 1);
              setRevealing({ card, finish: revealFinish });
            }}
          />
        ))}
      </Surface>

      <RevealModal
        key={round}
        reveal={revealing}
        firstTime={firstTime}
        onReplay={() => setRound((value) => value + 1)}
        onClose={() => setRevealing(null)}
      />
    </ScreenContainer>
  );
}

type RevealModalProps = {
  reveal: Reveal | null;
  firstTime: boolean;
  onReplay: () => void;
  onClose: () => void;
};

function RevealModal({ reveal, firstTime, onReplay, onClose }: RevealModalProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={reveal !== null} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <GestureHandlerRootView
        style={[styles.modal, { backgroundColor: colors.background, paddingTop: insets.top, paddingBottom: insets.bottom + spacing.md }]}
      >
        {reveal ? (
          <CardReveal card={reveal.card} finish={reveal.finish} isNew hintRarity firstTimeForRarity={firstTime} />
        ) : null}
        <View style={styles.actions}>
          <Button3D label={t('dev.cards.replay')} variant="secondary" onPress={onReplay} />
          <Button3D label={t('common.close')} onPress={onClose} />
        </View>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.sm },
  modal: { flex: 1 },
  actions: { flexDirection: 'row', justifyContent: 'center', gap: spacing.md, paddingHorizontal: spacing.md },
});
