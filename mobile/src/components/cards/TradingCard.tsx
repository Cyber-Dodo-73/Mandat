import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { GestureDetector } from 'react-native-gesture-handler';
import Animated from 'react-native-reanimated';

import { seasonSize } from '@/data/catalog';
import { formatCollectorNumber, useCardText, type CardText } from '@/features/collection/cardText';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { fontFamilies } from '@/theme';
import { rarityStyles } from '@/theme/rarity';
import { STAT_KEYS, type Card, type CardFinish } from '@/types/card';

import { AuraParticles } from './AuraParticles';
import { CardArtwork } from './CardArtwork';
import { cardLayout, type Box, type CardLayout } from './cardLayout';
import { cardMetrics, type CardMetrics, type CardSize } from './cardMetrics';
import { GOLD, isFinishAvailable, isPremium } from './finishes';
import { FlagChip } from './FlagChip';
import { HoloLayer } from './HoloLayer';
import { CARD_MUTED, CARD_PAPER, RarityFrame } from './RarityFrame';
import { RarityPips } from './RarityPips';
import { useTilt } from './useTilt';

export type TradingCardProps = {
  card: Card;
  /** Print version; full art falls back to standard below rare. */
  finish?: CardFinish;
  size?: CardSize;
  /** Overrides the width of the size preset (height follows the 63×88 ratio). */
  width?: number;
  /** Drag to tilt the card in 3D. Defaults to true for large and hero cards. */
  interactive?: boolean;
  /** Follow the phone's orientation. Defaults to true for large and hero cards. */
  gyro?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A MANDAT trading card. Layers, bottom to top: rarity frame, portrait (or procedural artwork),
 * foil, then the printed text on opaque plates — the foil lights the frame and the art but
 * never washes out the text. Card text never scales with the system font size: the card is a
 * fixed-size object, read through its accessibility label instead.
 */
export const TradingCard = memo(function TradingCard({
  card,
  finish: requestedFinish = 'standard',
  size = 'grid',
  width,
  interactive,
  gyro,
  style,
}: TradingCardProps) {
  const finish = isFinishAvailable(card.rarity, requestedFinish) ? requestedFinish : 'standard';
  const metrics = cardMetrics(size, width);
  const reduceMotion = useReduceMotion();
  const isLarge = metrics.detail === 'full';
  const sober = card.sensitive;
  const { gesture, style: tiltStyle, tilt } = useTilt({
    width: metrics.width,
    pan: interactive ?? isLarge,
    gyro: gyro ?? isLarge,
    reduceMotion,
  });
  const live = isLarge && !reduceMotion;
  const text = useCardText(card);
  const layout = cardLayout(metrics, finish);
  const { t } = useTranslation();

  const auraColors =
    finish === 'gold' ? [GOLD.base, GOLD.glint, ...GOLD.gradient.slice(0, 2)] : rarityStyles[card.rarity].gradient;
  const showAura = live && !sober && (isPremium(card.rarity) || finish === 'gold');

  const accessibilityLabel = t('cards.a11yLabel', {
    name: text.name,
    rarity: t(`rarity.${card.rarity}`),
    role: text.role,
  });
  const finishLabel = finish === 'standard' ? '' : `, ${t(`cards.finish.${finish}`)}`;

  return (
    <GestureDetector gesture={gesture}>
      <Animated.View
        accessible
        accessibilityRole="image"
        accessibilityLabel={`${accessibilityLabel}${finishLabel}`}
        style={[{ width: metrics.width, height: metrics.height }, tiltStyle, style]}
      >
        {showAura ? <AuraParticles width={metrics.width} height={metrics.height} colors={auraColors} /> : null}
        <RarityFrame
          rarity={card.rarity}
          finish={finish}
          width={metrics.width}
          height={metrics.height}
          radius={metrics.radius}
          frame={metrics.frame}
          animated={live && !sober}
        />
        <ArtLayer card={card} finish={finish} layout={layout} metrics={metrics} name={text.name} />
        {/* Foil sits between the artwork and the text plates: it lights the frame and the art, never the text. */}
        <HoloLayer
          rarity={card.rarity}
          finish={finish}
          sober={sober}
          width={metrics.width}
          height={metrics.height}
          radius={metrics.radius}
          tilt={live ? tilt : undefined}
          animated={live}
        />
        <TextLayer card={card} finish={finish} layout={layout} text={text} />
      </Animated.View>
    </GestureDetector>
  );
});

/** Opaque printed plates: text keeps its contrast whatever foil or photo sits underneath. */
const PLATE = 'rgba(11, 15, 26, 0.92)';
const PLATE_STRONG = 'rgba(11, 15, 26, 0.95)';
const TABULAR = { fontVariant: ['tabular-nums' as const] };

function accentColor(card: Card, finish: CardFinish): string {
  return finish === 'gold' ? GOLD.base : rarityStyles[card.rarity].color;
}

function boxStyle(box: Box): ViewStyle {
  return { position: 'absolute', left: box.x, top: box.y, width: box.width, height: box.height };
}

type LayerProps = { card: Card; finish: CardFinish; layout: CardLayout };

function ArtLayer({ card, finish, layout, metrics, name }: LayerProps & { metrics: CardMetrics; name: string }) {
  const { art, innerRadius, shows } = layout;
  const fullArt = finish === 'full_art';
  return (
    <View
      pointerEvents="none"
      style={[boxStyle(art), { borderRadius: fullArt ? Math.max(2, metrics.radius - 2) : innerRadius, overflow: 'hidden' }]}
    >
      <CardArtwork
        card={card}
        name={name}
        width={art.width}
        height={art.height}
        fullBleed={fullArt}
        gold={finish === 'gold'}
        engraved={metrics.detail === 'full'}
      />
      {shows.flag || shows.lifespan ? <ArtChips card={card} layout={layout} /> : null}
    </View>
  );
}

/** Flag stripes and life span, each on its own small plate in the artwork corner. */
function ArtChips({ card, layout }: { card: Card; layout: CardLayout }) {
  const text = useCardText(card);
  const { type, platePadding } = layout;
  const chipHeight = Math.round(type.number * 1.7);
  const inset = platePadding * 0.75;
  return (
    <View style={[styles.chips, { top: inset, left: inset, right: inset }]}>
      <View style={[styles.chip, { height: chipHeight, borderRadius: chipHeight / 2, paddingHorizontal: chipHeight * 0.35 }]}>
        <FlagChip country={card.country} continent={card.continent} height={chipHeight * 0.55} />
      </View>
      {text.lifespan ? (
        <View style={[styles.chip, { height: chipHeight, borderRadius: chipHeight / 2, paddingHorizontal: chipHeight * 0.45 }]}>
          <Text allowFontScaling={false} style={[styles.chipText, TABULAR, { fontSize: type.number }]}>
            {text.lifespan}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

function TextLayer({ card, finish, layout, text }: LayerProps & { text: CardText }) {
  const { header, body, footer, platePadding, innerRadius, type, shows } = layout;
  const accent = accentColor(card, finish);
  const fullArt = finish === 'full_art';
  const plate: ViewStyle = {
    backgroundColor: fullArt ? PLATE_STRONG : PLATE,
    borderColor: `${accent}66`,
    borderRadius: innerRadius,
    borderWidth: StyleSheet.hairlineWidth,
  };
  const ownPlate = fullArt ? null : plate;

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {fullArt && header ? (
        // Full art: one continuous band from the name down to the footer.
        <View style={[plate, boxStyle({ ...header, height: footer.y + footer.height + platePadding / 2 - header.y })]} />
      ) : null}
      {header ? (
        <View style={[ownPlate, boxStyle(header), styles.headerContent, { paddingHorizontal: platePadding }]}>
          <Text
            allowFontScaling={false}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            style={[styles.name, { fontSize: type.name, lineHeight: type.nameLine }]}
          >
            {text.name}
          </Text>
        </View>
      ) : null}
      {body ? (
        <View style={[ownPlate, boxStyle(body), { padding: platePadding, gap: platePadding * 0.6 }]}>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.role, { fontSize: type.role, lineHeight: type.role * 1.3 }]}>
            {text.role}
          </Text>
          <Stats card={card} layout={layout} accent={accent} />
          <View>
            <Text
              allowFontScaling={false}
              numberOfLines={1}
              style={[styles.abilityName, { fontSize: type.abilityName, lineHeight: type.abilityName * 1.3, color: accent }]}
            >
              {text.abilityName}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.abilityText, { fontSize: type.abilityText, lineHeight: type.abilityText * 1.3 }]}
            >
              {text.abilityDescription}
            </Text>
          </View>
        </View>
      ) : null}
      <Footer card={card} finish={finish} layout={layout} plated={!fullArt && shows.name} />
    </View>
  );
}

function Stats({ card, layout, accent }: { card: Card; layout: CardLayout; accent: string }) {
  const { t } = useTranslation();
  const { type, platePadding, innerRadius } = layout;
  return (
    <View
      style={[
        styles.stats,
        { borderColor: `${accent}55`, borderRadius: Math.max(2, innerRadius * 0.7), paddingVertical: platePadding * 0.5 },
      ]}
    >
      {STAT_KEYS.map((key) => (
        <View key={key} style={styles.stat}>
          <Text
            allowFontScaling={false}
            style={[styles.statValue, TABULAR, { fontSize: type.statValue, lineHeight: type.statValue * 1.15 }]}
          >
            {card.stats[key]}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.statLabel, { fontSize: type.statLabel }]}>
            {t(`cards.statsShort.${key}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ card, finish, layout, plated }: { card: Card; finish: CardFinish; layout: CardLayout; plated: boolean }) {
  const { t } = useTranslation();
  const { footer, type, shows, platePadding, innerRadius } = layout;
  const pip = Math.max(4, Math.round(footer.height * 0.4));
  return (
    <View
      style={[
        boxStyle(footer),
        styles.footer,
        { paddingHorizontal: plated ? platePadding : platePadding / 2 },
        plated ? { backgroundColor: PLATE, borderRadius: innerRadius } : null,
      ]}
    >
      <RarityPips rarity={card.rarity} size={pip} />
      <View style={styles.footerRight}>
        {shows.finishLabel ? (
          <Text
            allowFontScaling={false}
            style={[styles.finish, { fontSize: type.number, color: finish === 'gold' ? GOLD.base : CARD_PAPER }]}
          >
            {t(`cards.finish.${finish}`)}
          </Text>
        ) : null}
        {shows.number ? (
          <Text allowFontScaling={false} style={[styles.number, TABULAR, { fontSize: type.number }]}>
            {formatCollectorNumber(card.number, seasonSize)}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  headerContent: { justifyContent: 'center' },
  name: { fontFamily: fontFamilies.displayHeavy, color: CARD_PAPER, letterSpacing: -0.2 },
  chips: { position: 'absolute', flexDirection: 'row', justifyContent: 'space-between' },
  chip: { backgroundColor: PLATE, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  chipText: { fontFamily: fontFamilies.bodyBold, color: CARD_PAPER },
  role: { fontFamily: fontFamilies.bodySemiBold, color: CARD_PAPER, opacity: 0.86 },
  stats: { flexDirection: 'row', borderWidth: 1 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fontFamilies.displayHeavy, color: CARD_PAPER },
  statLabel: { fontFamily: fontFamilies.bodyBold, color: CARD_MUTED, letterSpacing: 0.4 },
  abilityName: { fontFamily: fontFamilies.bodyBold },
  abilityText: { fontFamily: fontFamilies.bodyMedium, color: CARD_PAPER, opacity: 0.82 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  finish: { fontFamily: fontFamilies.bodyBold, letterSpacing: 0.3 },
  number: { fontFamily: fontFamilies.bodySemiBold, color: CARD_MUTED, letterSpacing: 0.3 },
});

