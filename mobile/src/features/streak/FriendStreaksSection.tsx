import { router } from 'expo-router';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { CosmeticEmblem } from '@/components/profile/CosmeticEmblem';
import { Body, Button3D, Caption, Card, Heading, Icon, PressableScale, Sheet, Text } from '@/components/ui';
import { formatNumber, useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';
import { StreakFlame } from '@/features/progression/StreakFlame';
import { useMyProfileQuery } from '@/features/profile/queries';
import { radius, spacing, useTheme } from '@/theme';

import type { FriendStreak, FriendStreakInvite } from './api';
import {
  canNudgeInStreak,
  friendStreakToday,
  markCelebrated,
  milestonesToCelebrate,
  readCelebrated,
} from './friendStreakView';
import { streakPalette } from './palette';
import {
  useAcceptFriendStreak,
  useDeclineFriendStreak,
  useFriendStreaksQuery,
  useNudgeFriend,
  useRemoveFriendStreak,
} from './queries';

/** Shared streaks with friends: who played today, invitations, nudges and milestone parties. */
export function FriendStreaksSection({ online }: { online: boolean }) {
  const { t } = useTranslation();
  const query = useFriendStreaksQuery();
  const accept = useAcceptFriendStreak();
  const decline = useDeclineFriendStreak();
  const remove = useRemoveFriendStreak();
  const [ending, setEnding] = useState<FriendStreak | null>(null);
  const [error, setError] = useState<string | null>(null);
  const view = query.data;

  const fail = (cause: unknown) => setError(describeError(cause, t));

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Heading>{t('friendStreak.title')}</Heading>
        {view ? (
          <Caption>{t('friendStreak.count', { count: view.streaks.length, max: view.maxFriendStreaks })}</Caption>
        ) : null}
      </View>

      {error ? (
        <Text accessibilityRole="alert" variant="label" tone="danger">
          {error}
        </Text>
      ) : null}

      {view?.incoming.map((invite) => (
        <InviteRow key={invite.id} invite={invite} label={t('friendStreak.incoming', { nickname: invite.friend.nickname })}>
          <Button3D
            label={t('friendStreak.accept')}
            size="sm"
            disabled={!online}
            onPress={() => accept.mutate(invite.id, { onError: fail })}
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('friendStreak.decline')}
            hitSlop={8}
            disabled={!online}
            onPress={() => decline.mutate(invite.id, { onError: fail })}
          >
            <Icon name="close" size={22} tone="textMuted" />
          </PressableScale>
        </InviteRow>
      ))}

      {view?.streaks.map((streak) => (
        <FriendStreakRow key={streak.id} streak={streak} online={online} onEnd={() => setEnding(streak)} onError={fail} />
      ))}

      {view?.outgoing.map((invite) => (
        <InviteRow key={invite.id} invite={invite} label={t('friendStreak.outgoing', { nickname: invite.friend.nickname })}>
          <Button3D
            label={t('friendStreak.cancel')}
            variant="ghost"
            size="sm"
            disabled={!online}
            onPress={() => remove.mutate(invite.id, { onError: fail })}
          />
        </InviteRow>
      ))}

      {view && view.streaks.length + view.outgoing.length < view.maxFriendStreaks ? (
        <Card style={styles.empty}>
          {view.streaks.length === 0 ? <Body align="center">{t('friendStreak.empty')}</Body> : null}
          <Button3D label={t('friendStreak.invite')} icon="people" variant="secondary" fullWidth onPress={() => router.push('/friends')} />
        </Card>
      ) : null}
      {query.isError && !view ? <Body tone="muted">{describeError(query.error, t)}</Body> : null}

      <Sheet visible={ending !== null} onClose={() => setEnding(null)} title={t('friendStreak.end.title', { nickname: ending?.friend.nickname ?? '' })}>
        <Body>{t('friendStreak.end.body')}</Body>
        <Button3D
          label={t('friendStreak.end.confirm')}
          variant="danger"
          fullWidth
          loading={remove.isPending}
          onPress={() => {
            if (!ending) return;
            remove.mutate(ending.id, { onSuccess: () => setEnding(null), onError: fail });
          }}
        />
        <Button3D label={t('friendStreak.end.cancel')} variant="secondary" fullWidth onPress={() => setEnding(null)} />
      </Sheet>

      <MilestoneCelebration streaks={view?.streaks ?? []} />
    </View>
  );
}

function InviteRow({ invite, label, children }: { invite: FriendStreakInvite; label: string; children: ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.invite, { backgroundColor: colors.surface, borderColor: streakPalette.flame }]}>
      <CosmeticEmblem kind="avatar" id={invite.friend.avatarId} size={40} />
      <Text variant="bodyStrong" style={styles.flex} numberOfLines={2}>
        {label}
      </Text>
      {children}
    </View>
  );
}

function FriendStreakRow({
  streak,
  online,
  onEnd,
  onError,
}: {
  streak: FriendStreak;
  online: boolean;
  onEnd: () => void;
  onError: (cause: unknown) => void;
}) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const me = useMyProfileQuery();
  const nudge = useNudgeFriend();
  const [nudged, setNudged] = useState(false);
  const today = friendStreakToday(streak);
  const lit = today === 'bothDone';

  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: lit ? streakPalette.flame : colors.border }]}>
      <View style={styles.pair}>
        <Avatar id={me.data?.profile.avatarId} done={streak.meDoneToday} />
        <View style={styles.sharedFlame}>
          <StreakFlame streak={streak.current} activeToday={lit} base={34} />
          <Text variant="heading" color={lit ? streakPalette.flame : colors.text}>
            {formatNumber(streak.current, language)}
          </Text>
        </View>
        <Avatar id={streak.friend.avatarId} done={streak.friendDoneToday} />
      </View>
      <View style={styles.flex}>
        <Text variant="bodyStrong" numberOfLines={1}>
          {streak.friend.nickname}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {t(`friendStreak.today.${today}`, { nickname: streak.friend.nickname })}
        </Text>
        {streak.nextMilestone ? (
          <Text variant="caption" color={streakPalette.flame}>
            {t('friendStreak.nextMilestone', { count: streak.nextMilestone })}
          </Text>
        ) : null}
      </View>
      <View style={styles.actions}>
        {canNudgeInStreak(streak) ? (
          <Button3D
            label={nudged ? t('friendStreak.nudge.sent') : t('friendStreak.nudge.button')}
            size="sm"
            variant={nudged ? 'secondary' : 'primary'}
            disabled={!online || nudged}
            loading={nudge.isPending}
            onPress={() =>
              nudge.mutate(streak.friend.friendCode, {
                onSuccess: () => setNudged(true),
                onError,
              })
            }
          />
        ) : null}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={t('friendStreak.end.button', { nickname: streak.friend.nickname })}
          hitSlop={8}
          disabled={!online}
          onPress={onEnd}
        >
          <Icon name="ellipsis-horizontal" size={20} tone="textMuted" />
        </PressableScale>
      </View>
    </View>
  );
}

function Avatar({ id, done }: { id: string | undefined; done: boolean }) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={[styles.avatarRing, { borderColor: done ? streakPalette.flame : colors.border }]}>
        {id ? <CosmeticEmblem kind="avatar" id={id} size={38} /> : <Icon name="person" size={22} tone="textMuted" />}
      </View>
      <View style={[styles.check, { backgroundColor: done ? colors.success : colors.surfaceRaised, borderColor: colors.surface }]}>
        <Icon name={done ? 'checkmark' : 'time-outline'} size={11} color={done ? colors.onAccent : colors.textMuted} />
      </View>
    </View>
  );
}

/** Party sheet for a shared milestone, once per streak and milestone on this device. */
function MilestoneCelebration({ streaks }: { streaks: readonly FriendStreak[] }) {
  const { t } = useTranslation();
  const language = useLanguage();
  const [celebrated, setCelebrated] = useState(readCelebrated);
  const showing = useMemo(() => milestonesToCelebrate(streaks, celebrated)[0] ?? null, [celebrated, streaks]);
  const showingKey = showing ? `${showing.id}:${showing.current}` : null;

  // Once per milestone: a refetch of the same streak must not replay it.
  const played = useRef<string | null>(null);
  useEffect(() => {
    if (!showing || played.current === showingKey) return;
    played.current = showingKey;
    markCelebrated(showing);
    haptics.levelUp();
    playSound('level_up');
  }, [showing, showingKey]);

  const close = () => setCelebrated(readCelebrated());

  return (
    <Sheet visible={showing !== null} onClose={close} title={t('friendStreak.celebration.title')}>
      <View style={styles.party}>
        <StreakFlame streak={showing?.current ?? 30} activeToday base={96} />
        <Text variant="title" align="center" color={streakPalette.flame}>
          {t('friendStreak.celebration.days', { count: showing?.current ?? 0, value: formatNumber(showing?.current ?? 0, language) })}
        </Text>
        <Body align="center">{t('friendStreak.celebration.body', { nickname: showing?.friend.nickname ?? '' })}</Body>
      </View>
      <Button3D label={t('friendStreak.celebration.cta')} fullWidth onPress={close} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  head: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  flex: { flex: 1 },
  empty: { alignItems: 'stretch' },
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius,
    borderWidth: 2,
    borderStyle: 'dashed',
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, padding: spacing.sm, borderRadius: radius, borderWidth: 3 },
  pair: { flexDirection: 'row', alignItems: 'center' },
  sharedFlame: { alignItems: 'center', marginHorizontal: -4, zIndex: 1 },
  avatarRing: { width: 44, height: 44, borderRadius: 22, borderWidth: 3, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  check: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actions: { alignItems: 'flex-end', gap: spacing.xs },
  party: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.sm },
});
