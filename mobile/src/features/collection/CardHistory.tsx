import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';

import { Body, Caption, Card as Surface, Heading, Icon, PressableScale, SegmentedControl, Text } from '@/components/ui';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { fontFamilies, radius, spacing, useTheme, type ThemeColors } from '@/theme';
import type { TimelineKind } from '@/types/card';

import { highlightIcon, TIMELINE_ICONS, useCardDetails, type CardDetails, type TimelineRow } from './cardDetails';

type Section = 'summary' | 'story' | 'timeline';

/** Stories longer than this start collapsed behind "Read more". */
const STORY_COLLAPSE_CHARS = 700;
const STORY_COLLAPSED_LINES = 9;
/** Timeline labels longer than this are clamped to two lines until tapped. */
const LABEL_COLLAPSE_CHARS = 70;

type CardHistoryProps = {
  cardId: string;
  /** Perpetrators of mass crimes: same content, no celebratory accents. */
  sober: boolean;
};

/** Résumé · Histoire · Parcours: who they were, what they did, when. */
export function CardHistory({ cardId, sober }: CardHistoryProps) {
  const { t } = useTranslation();
  const details = useCardDetails(cardId);
  const [section, setSection] = useState<Section>('summary');
  if (!details) return null;

  const options = [
    { value: 'summary' as const, label: t('card.history.summary') },
    ...(details.story ? [{ value: 'story' as const, label: t('card.history.story') }] : []),
    ...(details.timeline.length > 0 ? [{ value: 'timeline' as const, label: t('card.history.timeline') }] : []),
  ];

  return (
    <View style={styles.root}>
      {options.length > 1 ? (
        <SegmentedControl
          options={options}
          value={section}
          onChange={setSection}
          accessibilityLabel={t('card.history.sections')}
        />
      ) : null}
      {section === 'summary' ? <Summary details={details} sober={sober} /> : null}
      {section === 'story' && details.story ? <Story text={details.story} /> : null}
      {section === 'timeline' ? <Timeline rows={details.timeline} sober={sober} /> : null}
    </View>
  );
}

function Summary({ details, sober }: { details: CardDetails; sober: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <>
      <Surface>
        <Heading>{t('card.bio')}</Heading>
        <Body style={styles.reading}>{details.bio}</Body>
      </Surface>
      {details.highlights.length > 0 ? (
        <Surface>
          <Heading>{t('card.history.highlights')}</Heading>
          <View style={styles.highlights}>
            {details.highlights.map((item) => (
              <View key={item} style={styles.highlightRow}>
                <View style={[styles.highlightIcon, { borderColor: sober ? colors.border : colors.hairline }]}>
                  <Icon name={highlightIcon(item)} size={16} color={sober ? colors.textMuted : colors.brand} />
                </View>
                <Body style={styles.flex}>{item}</Body>
              </View>
            ))}
          </View>
        </Surface>
      ) : null}
      {details.legacy ? (
        <View
          accessible
          accessibilityLabel={`${t('card.history.legacy')}. ${details.legacy}`}
          style={[styles.legacy, { borderLeftColor: sober ? colors.border : colors.brand }]}
        >
          <Caption>{t('card.history.legacy')}</Caption>
          <Text variant="bodyStrong" style={styles.reading}>
            {details.legacy}
          </Text>
        </View>
      ) : null}
    </>
  );
}

function Story({ text }: { text: string }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const long = text.length > STORY_COLLAPSE_CHARS;
  const [expanded, setExpanded] = useState(!long);
  const first = text.slice(0, 1);
  const rest = text.slice(1);
  return (
    <Surface>
      <Heading>{t('card.history.storyTitle')}</Heading>
      <Text
        variant="body"
        accessibilityLabel={text}
        numberOfLines={expanded ? undefined : STORY_COLLAPSED_LINES}
        style={styles.story}
      >
        <Text variant="body" style={[styles.initial, { color: colors.brand }]}>
          {first}
        </Text>
        {rest}
      </Text>
      {long ? (
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
          style={styles.more}
        >
          <Text variant="label" color={colors.brand}>
            {expanded ? t('card.history.readLess') : t('card.history.readMore')}
          </Text>
          <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.brand} />
        </PressableScale>
      ) : null}
    </Surface>
  );
}

function kindColor(kind: TimelineKind, colors: ThemeColors, sober: boolean): string {
  if (sober) return kind === 'birth' || kind === 'death' ? colors.textMuted : colors.text;
  switch (kind) {
    case 'office':
      return colors.brand;
    case 'award':
      return colors.goldBright;
    case 'birth':
      return colors.success;
    case 'death':
      return colors.textMuted;
    case 'education':
    case 'event':
      return colors.text;
  }
}

function Timeline({ rows, sober }: { rows: readonly TimelineRow[]; sober: boolean }) {
  const { t } = useTranslation();
  return (
    <Surface>
      <Heading>{t('card.history.timelineTitle')}</Heading>
      <View accessibilityRole="list">
        {rows.map((row, index) => (
          <TimelineItem key={row.key} row={row} index={index} last={index === rows.length - 1} sober={sober} />
        ))}
      </View>
      <Caption>{t('card.history.timelineSource')}</Caption>
    </Surface>
  );
}

function TimelineItem({ row, index, last, sober }: { row: TimelineRow; index: number; last: boolean; sober: boolean }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const reduceMotion = useReduceMotion();
  const long = row.label.length > LABEL_COLLAPSE_CHARS;
  const [expanded, setExpanded] = useState(false);
  const color = kindColor(row.kind, colors, sober);
  const kindLabel = t(`card.history.kinds.${row.kind}`);

  const content = (
    <View style={styles.itemRow}>
      <Text variant="label" tone="muted" style={styles.year}>
        {row.when}
      </Text>
      <View style={styles.rail}>
        <View style={[styles.dot, { borderColor: color, backgroundColor: colors.surface }]}>
          <Icon name={TIMELINE_ICONS[row.kind]} size={12} color={color} />
        </View>
        {last ? null : <View style={[styles.line, { backgroundColor: colors.border }]} />}
      </View>
      <View style={styles.itemText}>
        <Caption>{kindLabel}</Caption>
        <Body numberOfLines={long && !expanded ? 2 : undefined}>{row.label}</Body>
      </View>
    </View>
  );

  return (
    <Animated.View
      accessibilityRole="text"
      entering={reduceMotion ? undefined : FadeInDown.delay(Math.min(index, 10) * 45).duration(260)}
    >
      {long ? (
        <PressableScale
          haptic="none"
          pressedScale={0.98}
          accessibilityRole="button"
          accessibilityLabel={`${row.when}, ${kindLabel}, ${row.label}`}
          accessibilityState={{ expanded }}
          onPress={() => setExpanded((value) => !value)}
        >
          {content}
        </PressableScale>
      ) : (
        <View accessible accessibilityLabel={`${row.when}, ${kindLabel}, ${row.label}`}>
          {content}
        </View>
      )}
    </Animated.View>
  );
}

const DOT = 24;

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  flex: { flex: 1 },
  reading: { lineHeight: 24 },
  story: { lineHeight: 25, maxWidth: 640 },
  initial: { fontFamily: fontFamilies.displayHeavy, fontSize: 26, lineHeight: 25 },
  more: { flexDirection: 'row', alignItems: 'center', gap: spacing.xxs, alignSelf: 'flex-start', minHeight: 44 },
  highlights: { gap: spacing.sm },
  highlightRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  highlightIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  legacy: { gap: spacing.xxs, paddingVertical: spacing.sm, paddingLeft: spacing.md, borderLeftWidth: 3, borderRadius: radius / 4 },
  itemRow: { flexDirection: 'row', gap: spacing.sm },
  year: { width: 92, textAlign: 'right', paddingTop: 3, fontVariant: ['tabular-nums'] },
  rail: { width: DOT, alignItems: 'center' },
  dot: { width: DOT, height: DOT, borderRadius: DOT / 2, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  line: { flex: 1, width: 2, minHeight: spacing.md },
  itemText: { flex: 1, gap: 2, paddingBottom: spacing.md },
});
