import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { cardMetrics, TradingCard } from '@/components/cards';
import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import {
  Body,
  Button3D,
  Caption,
  EmptyState,
  Heading,
  Icon,
  PressableScale,
  SegmentedControl,
  Text,
  TextField,
  Title,
} from '@/components/ui';
import { buildEntries, type CollectionEntry } from '@/features/collection/collectionModel';
import { useCollectionQuery } from '@/features/collection/queries';
import { allCards } from '@/data/catalog';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { radius, spacing, useTheme } from '@/theme';

import { activeDuel, DIFFICULTIES, TEAM_SIZE, useCreateDuel, useDuel, type Difficulty } from './api';
import { deckCandidates, toggleTeam } from './deck';
import { StatPills } from './StatPills';
import { isDuelResumable } from './viewModel';

const THUMB = cardMetrics('thumb');

/** Pick 3 owned cards and a difficulty, then the server builds the AI team. */
export function DuelSetupScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const online = useIsOnline();
  const collection = useCollectionQuery();
  const create = useCreateDuel();
  const [team, setTeam] = useState<string[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>('normal');
  const [query, setQuery] = useState('');
  const storedId = activeDuel.get();
  const stored = useDuel(storedId);
  const resumable = isDuelResumable(stored.data);

  const entries = useMemo(
    () => buildEntries(allCards, collection.data?.items ?? []),
    [collection.data],
  );
  const candidates = useMemo(() => deckCandidates(entries, query), [entries, query]);
  const ownedCount = entries.filter((entry) => entry.owned).length;
  const byId = useMemo(() => new Map(entries.map((entry) => [entry.card.id, entry])), [entries]);

  const start = () => {
    create.mutate(
      { cardIds: team, difficulty },
      { onSuccess: (duel) => router.replace({ pathname: '/duel/[id]', params: { id: duel.id } }) },
    );
  };

  const renderItem = ({ item }: { item: CollectionEntry }) => {
    const position = team.indexOf(item.card.id);
    const selected = position >= 0;
    const full = team.length >= TEAM_SIZE && !selected;
    return (
      <PressableScale
        haptic="toggle"
        accessibilityRole="checkbox"
        accessibilityState={{ checked: selected, disabled: full }}
        accessibilityLabel={item.card.name[language] || item.card.name.fr}
        onPress={() => setTeam((current) => toggleTeam(current, item.card.id, TEAM_SIZE))}
        style={[
          styles.row,
          {
            backgroundColor: selected ? colors.surfaceRaised : colors.surface,
            borderColor: selected ? colors.accent : colors.border,
            opacity: full ? 0.5 : 1,
          },
        ]}
      >
        <TradingCard card={item.card} finish={item.bestFinish} size="thumb" interactive={false} gyro={false} />
        <View style={styles.rowText}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {item.card.name[language] || item.card.name.fr}
          </Text>
          <StatPills stats={item.card.stats} />
          <Caption tone="muted" numberOfLines={1}>
            {item.card.ability.name[language] || item.card.ability.name.fr}
          </Caption>
        </View>
        <View style={[styles.check, { borderColor: selected ? colors.accent : colors.border, backgroundColor: selected ? colors.accent : 'transparent' }]}>
          {selected ? (
            <Text variant="label" color={colors.onAccent}>
              {position + 1}
            </Text>
          ) : null}
        </View>
      </PressableScale>
    );
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + spacing.xs }]}>
      <View style={styles.header}>
        <PressableScale accessibilityRole="button" accessibilityLabel={t('common.back')} hitSlop={12} onPress={() => router.back()}>
          <Icon name="arrow-back" size={28} />
        </PressableScale>
        <Title style={styles.title}>{t('duel.setup.title')}</Title>
      </View>

      {resumable && storedId ? (
        <PressableScale
          accessibilityRole="button"
          onPress={() => router.replace({ pathname: '/duel/[id]', params: { id: storedId } })}
          style={[styles.resume, { borderColor: colors.accent, backgroundColor: colors.surface }]}
        >
          <Icon name="play" size={22} tone="accent" />
          <Body style={styles.flex}>{t('duel.setup.resume')}</Body>
          <Icon name="chevron-forward" size={20} tone="textMuted" />
        </PressableScale>
      ) : null}

      <View style={styles.tray} accessible accessibilityLabel={t('duel.setup.teamA11y', { count: team.length, total: TEAM_SIZE })}>
        {Array.from({ length: TEAM_SIZE }, (_, index) => {
          const entry = team[index] ? byId.get(team[index]) : undefined;
          return (
            <View key={index} style={styles.slot}>
              {entry ? (
                <TradingCard card={entry.card} finish={entry.bestFinish} size="thumb" interactive={false} gyro={false} />
              ) : (
                <View style={[styles.emptySlot, { borderColor: colors.border }]}>
                  <Text variant="heading" tone="muted">
                    {index + 1}
                  </Text>
                </View>
              )}
            </View>
          );
        })}
      </View>

      <View style={styles.controls}>
        <SegmentedControl
          options={DIFFICULTIES.map((value) => ({ value, label: t(`duel.difficulty.${value}`) }))}
          value={difficulty}
          onChange={setDifficulty}
          accessibilityLabel={t('duel.setup.difficulty')}
        />
        <Caption tone="muted">{t(`duel.difficultyHint.${difficulty}`)}</Caption>
        <TextField label={t('duel.setup.search')} value={query} onChangeText={setQuery} autoCorrect={false} />
      </View>

      {ownedCount < TEAM_SIZE && !collection.isPending ? (
        <EmptyState icon="albums-outline" message={t('duel.setup.notEnoughCards', { count: TEAM_SIZE })} />
      ) : (
        <FlatList
          data={candidates}
          keyExtractor={(item) => item.card.id}
          renderItem={renderItem}
          extraData={team}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={Separator}
          initialNumToRender={12}
          windowSize={7}
          keyboardShouldPersistTaps="handled"
        />
      )}

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md, borderTopColor: colors.border }]}>
        {!online ? <OfflineNotice message={t('duel.offline')} /> : null}
        {create.error ? <Body tone="danger">{describeError(create.error, t)}</Body> : null}
        <Heading align="center">{t('duel.setup.picked', { count: team.length, total: TEAM_SIZE })}</Heading>
        <Button3D
          label={t('duel.setup.start')}
          icon="flash"
          size="lg"
          fullWidth
          disabled={team.length !== TEAM_SIZE || !online}
          loading={create.isPending}
          onPress={start}
        />
      </View>
    </View>
  );
}

function Separator() {
  return <View style={styles.separator} />;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  title: { flex: 1 },
  resume: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.md,
    marginTop: spacing.sm,
    padding: spacing.md,
    borderRadius: radius,
    borderWidth: 2,
  },
  tray: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, paddingVertical: spacing.md },
  slot: { alignItems: 'center' },
  emptySlot: {
    width: THUMB.width,
    height: THUMB.height,
    borderRadius: THUMB.radius,
    borderWidth: 2,
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
  },
  controls: { gap: spacing.xs, paddingHorizontal: spacing.md },
  list: { padding: spacing.md, paddingBottom: spacing.xl },
  separator: { height: spacing.xs },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xs,
    paddingRight: spacing.md,
    borderRadius: radius,
    borderWidth: 2,
  },
  rowText: { flex: 1, gap: spacing.xxs },
  check: { width: 28, height: 28, borderRadius: 14, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  footer: { gap: spacing.xs, paddingHorizontal: spacing.md, paddingTop: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth },
});
