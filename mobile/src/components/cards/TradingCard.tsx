import { memo } from 'react';
import { StyleSheet, Text, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
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
 * printed text, foil. Card text never scales with the system font size: the card is a
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
        {finish === 'full_art' ? (
          <FullArtFace card={card} metrics={metrics} text={text} />
        ) : (
          <CardFace card={card} finish={finish} metrics={metrics} text={text} />
        )}
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
      </Animated.View>
    </GestureDetector>
  );
});

type FaceProps = {
  card: Card;
  metrics: CardMetrics;
  text: CardText;
};

function nameStyle(metrics: CardMetrics, unit: number): TextStyle {
  const full = metrics.detail === 'full';
  return {
    fontFamily: fontFamilies.displayHeavy,
    fontSize: full ? 21 * unit : Math.max(9, 24 * unit),
    lineHeight: full ? 25 * unit : Math.max(11, 28 * unit),
    letterSpacing: -0.3 * unit,
    color: CARD_PAPER,
  };
}

function CardFace({ card, finish, metrics, text }: FaceProps & { finish: CardFinish }) {
  const { width, frame, padding, artHeight, detail } = metrics;
  const unit = width / 300;
  const inset = frame + padding;
  const artWidth = width - inset * 2;
  const artRadius = Math.max(2, Math.round(metrics.radius * 0.45));
  const color = finish === 'gold' ? GOLD.base : rarityStyles[card.rarity].color;

  return (
    <View style={[StyleSheet.absoluteFill, { padding: inset, gap: Math.max(3, 7 * unit) }]}>
      {detail !== 'minimal' ? (
        <View style={styles.headerRow}>
          <Text allowFontScaling={false} numberOfLines={1} style={[nameStyle(metrics, unit), styles.flex]}>
            {text.name}
          </Text>
          {detail === 'full' ? <FlagChip country={card.country} continent={card.continent} height={13 * unit} /> : null}
        </View>
      ) : null}

      <View style={{ width: artWidth, height: artHeight - inset, borderRadius: artRadius, overflow: 'hidden' }}>
        <CardArtwork
          card={card}
          name={text.name}
          width={artWidth}
          height={artHeight - inset}
          gold={finish === 'gold'}
          engraved={detail === 'full'}
        />
        {detail === 'full' ? (
          <Text allowFontScaling={false} style={[styles.lifespan, { fontSize: 11 * unit, right: 8 * unit, top: 6 * unit }]}>
            {text.lifespan}
          </Text>
        ) : null}
      </View>

      {detail === 'full' ? (
        <>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.role, { fontSize: 13 * unit, lineHeight: 17 * unit }]}>
            {text.role}
          </Text>
          <Stats card={card} unit={unit} color={color} radius={artRadius} />
          <View style={styles.flex}>
            <Text allowFontScaling={false} numberOfLines={1} style={[styles.abilityName, { fontSize: 13 * unit, color }]}>
              {text.abilityName}
            </Text>
            <Text
              allowFontScaling={false}
              numberOfLines={2}
              style={[styles.abilityDescription, { fontSize: 11.5 * unit, lineHeight: 15 * unit }]}
            >
              {text.abilityDescription}
            </Text>
          </View>
        </>
      ) : (
        <View style={styles.flex} />
      )}

      <Footer card={card} finish={finish} metrics={metrics} unit={unit} />
    </View>
  );
}

/** Full art: the illustration covers the face, text floats on a translucent band. */
function FullArtFace({ card, metrics, text }: FaceProps) {
  const { width, height, radius, detail } = metrics;
  const frame = Math.max(2, Math.round(metrics.frame * 0.6));
  const unit = width / 300;
  const innerWidth = width - frame * 2;
  const innerHeight = height - frame * 2;
  const innerRadius = Math.max(2, radius - frame * 0.6);
  const pad = Math.max(4, 12 * unit);
  const color = rarityStyles[card.rarity].color;

  return (
    <View style={[StyleSheet.absoluteFill, { padding: frame }]}>
      <View style={{ width: innerWidth, height: innerHeight, borderRadius: innerRadius, overflow: 'hidden' }}>
        <CardArtwork
          card={card}
          name={text.name}
          width={innerWidth}
          height={innerHeight}
          fullBleed
          engraved={detail === 'full'}
        />
        {detail === 'full' ? (
          <View style={[styles.fullArtTop, { padding: pad }]}>
            <FlagChip country={card.country} continent={card.continent} height={13 * unit} />
            <Text allowFontScaling={false} style={[styles.lifespanInline, { fontSize: 11 * unit }]}>
              {text.lifespan}
            </Text>
          </View>
        ) : null}
        <View style={[styles.band, { padding: pad, gap: Math.max(2, 5 * unit) }]}>
          {detail !== 'minimal' ? (
            <Text allowFontScaling={false} numberOfLines={1} style={nameStyle(metrics, unit)}>
              {text.name}
            </Text>
          ) : null}
          {detail === 'full' ? (
            <>
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.role, { fontSize: 13 * unit, lineHeight: 17 * unit }]}>
                {text.role}
              </Text>
              <Stats card={card} unit={unit} color={color} radius={Math.max(2, Math.round(radius * 0.45))} />
              <Text allowFontScaling={false} numberOfLines={1} style={[styles.abilityName, { fontSize: 13 * unit, color }]}>
                {text.abilityName}
              </Text>
            </>
          ) : null}
          <Footer card={card} finish="full_art" metrics={metrics} unit={unit} />
        </View>
      </View>
    </View>
  );
}

function Stats({ card, unit, color, radius }: { card: Card; unit: number; color: string; radius: number }) {
  const { t } = useTranslation();
  return (
    <View style={[styles.stats, { borderColor: `${color}55`, borderRadius: radius, paddingVertical: 6 * unit }]}>
      {STAT_KEYS.map((key) => (
        <View key={key} style={styles.stat}>
          <Text allowFontScaling={false} style={[styles.statValue, { fontSize: 19 * unit, lineHeight: 22 * unit }]}>
            {card.stats[key]}
          </Text>
          <Text allowFontScaling={false} numberOfLines={1} style={[styles.statLabel, { fontSize: 9.5 * unit }]}>
            {t(`cards.statsShort.${key}`)}
          </Text>
        </View>
      ))}
    </View>
  );
}

function Footer({ card, finish, metrics, unit }: { card: Card; finish: CardFinish; metrics: CardMetrics; unit: number }) {
  const { t } = useTranslation();
  const { detail } = metrics;
  const pip = Math.max(4, (detail === 'full' ? 7 : 9) * unit * (detail === 'minimal' ? 1.6 : 1));
  return (
    <View style={styles.footer}>
      <RarityPips rarity={card.rarity} size={pip} />
      {detail !== 'minimal' ? (
        <View style={styles.footerRight}>
          {finish !== 'standard' && detail === 'full' ? (
            <Text
              allowFontScaling={false}
              style={[styles.finish, { fontSize: 9.5 * unit, color: finish === 'gold' ? GOLD.base : CARD_PAPER }]}
            >
              {t(`cards.finish.${finish}`)}
            </Text>
          ) : null}
          <Text allowFontScaling={false} style={[styles.number, { fontSize: Math.max(7, 10.5 * unit) }]}>
            {formatCollectorNumber(card.number, seasonSize)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  lifespan: {
    position: 'absolute',
    fontFamily: fontFamilies.bodySemiBold,
    color: CARD_PAPER,
    opacity: 0.85,
  },
  lifespanInline: { fontFamily: fontFamilies.bodySemiBold, color: CARD_PAPER, opacity: 0.85 },
  fullArtTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  band: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(11, 15, 26, 0.62)',
  },
  role: { fontFamily: fontFamilies.bodySemiBold, color: CARD_MUTED },
  stats: { flexDirection: 'row', borderWidth: 1 },
  stat: { flex: 1, alignItems: 'center' },
  statValue: { fontFamily: fontFamilies.displayHeavy, color: CARD_PAPER },
  statLabel: { fontFamily: fontFamilies.bodyBold, color: CARD_MUTED, letterSpacing: 0.4 },
  abilityName: { fontFamily: fontFamilies.bodyBold },
  abilityDescription: { fontFamily: fontFamilies.bodyRegular, color: CARD_MUTED },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 2 },
  footerRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  finish: { fontFamily: fontFamilies.bodyBold, letterSpacing: 0.3 },
  number: { fontFamily: fontFamilies.bodySemiBold, color: CARD_MUTED, letterSpacing: 0.3 },
});
