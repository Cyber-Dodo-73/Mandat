import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { BadgeGrid } from '@/components/profile/BadgeGrid';
import { ProfileHeader } from '@/components/profile/ProfileHeader';
import { ShowcaseGrid } from '@/components/profile/ShowcaseGrid';
import { StatsGrid } from '@/components/profile/StatsGrid';
import {
  Body,
  Button3D,
  Caption,
  EmptyState,
  Heading,
  Icon,
  PressableScale,
  ScreenContainer,
  SegmentedControl,
  Text,
} from '@/components/ui';
import { useMeQuery } from '@/features/player/queries';
import type { BadgeItem } from '@/features/profile/badges';
import { badgeFamily } from '@/features/profile/cosmetics';
import { usePublicProfileQuery } from '@/features/profile/queries';
import { useTranslation } from '@/i18n';
import { ApiError, describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { spacing, useTheme } from '@/theme';

import { CompareView } from './CompareView';
import { normalizeFriendCode } from './friendCode';
import { useAddFriendMutation, useFriendsQuery } from './queries';
import { ReportSheet } from './ReportSheet';

type Tab = 'profile' | 'compare';

/** Another player's profile (`/user/<friendCode>`): showcase, stats, badges, compare, report. */
export function UserProfileScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const friendCode = normalizeFriendCode(id ?? '');
  const me = useMeQuery();
  const profile = usePublicProfileQuery(friendCode);
  const friends = useFriendsQuery();
  const add = useAddFriendMutation();
  const [tab, setTab] = useState<Tab>('profile');
  const [reporting, setReporting] = useState(false);
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const recentBadges = useMemo<BadgeItem[]>(
    () =>
      (profile.data?.achievements.recent ?? []).map((achievementId) => ({
        id: achievementId,
        family: badgeFamily(achievementId),
        metal: 'gold',
        unlocked: true,
        progress: 1,
        threshold: Number(/_(\d+)$/.exec(achievementId)?.[1] ?? 0),
        param: null,
      })),
    [profile.data],
  );

  if (me.data && me.data.account.friendCode === friendCode) return <Redirect href="/profile" />;

  const outgoing = friends.data?.outgoing.some((friend) => friend.friendCode === friendCode) ?? false;
  const incoming = friends.data?.incoming.some((friend) => friend.friendCode === friendCode) ?? false;

  const onAdd = () => {
    setMessage(null);
    add.mutate(friendCode, {
      onSuccess: (response) => {
        haptics.newCard();
        setMessage({ tone: 'success', text: t(`friends.added.${response.result}` as 'friends.added.requested') });
      },
      onError: (error) => {
        haptics.error();
        setMessage({ tone: 'danger', text: describeError(error, t) });
      },
    });
  };

  const friendButton = (isFriend: boolean) =>
    isFriend ? (
      <View style={[styles.friendBadge, { borderColor: colors.success }]}>
        <Icon name="people" size={16} tone="success" />
        <Text variant="label" tone="success">
          {t('social.friend')}
        </Text>
      </View>
    ) : (
      <Button3D
        label={outgoing ? t('friends.pending') : incoming ? t('friends.accept') : t('friends.add.button')}
        icon={outgoing ? 'time-outline' : 'person-add'}
        size="sm"
        disabled={outgoing}
        loading={add.isPending}
        onPress={onAdd}
      />
    );

  const reportButton = (nickname: string) => (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={t('report.open', { nickname })}
      hitSlop={10}
      onPress={() => setReporting(true)}
    >
      <Icon name="flag-outline" size={22} tone="textMuted" />
    </PressableScale>
  );

  if (!profile.data) {
    const error = profile.error;
    const isPrivate = error instanceof ApiError && error.code === 'profile_private';
    const missing = error instanceof ApiError && error.status === 404;
    return (
      <ScreenContainer edges={['top', 'bottom']}>
        <ScreenHeader title={t('user.title')} />
        {profile.isPending ? (
          <EmptyState icon="person-outline" message={t('common.loading')} />
        ) : isPrivate ? (
          <View style={styles.centered}>
            <Icon name="lock-closed" size={40} tone="textMuted" />
            <Heading>{t('social.private.title')}</Heading>
            <Body tone="muted" align="center">
              {t('social.private.body')}
            </Body>
            {friendButton(false)}
          </View>
        ) : (
          <View style={styles.centered}>
            <EmptyState icon="search-outline" message={missing ? t('social.notFound') : describeError(error, t)} />
            {!missing ? <Button3D label={t('common.retry')} variant="secondary" onPress={() => void profile.refetch()} /> : null}
          </View>
        )}
        {message ? (
          <Text accessibilityRole="alert" variant="label" align="center" color={message.tone === 'success' ? colors.success : colors.danger}>
            {message.text}
          </Text>
        ) : null}
      </ScreenContainer>
    );
  }

  const data = profile.data;
  const contentWidth = width - spacing.md * 2;

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <ScreenHeader title={data.nickname} />
        </View>
        {reportButton(data.nickname)}
      </View>

      <ProfileHeader
        width={contentWidth}
        nickname={data.nickname}
        friendCode={data.friendCode}
        avatarId={data.avatarId}
        bannerId={data.bannerId}
        titleId={data.titleId}
        codeLabel={t('profile.friendCode')}
      />

      <View style={styles.friendRow}>
        <Caption style={styles.flex}>
          {t('profile.stats.collection', { count: data.stats.distinctCards, total: data.stats.seasonCards })}
        </Caption>
        {friendButton(data.friend)}
      </View>
      {message ? (
        <Text accessibilityRole="alert" variant="label" color={message.tone === 'success' ? colors.success : colors.danger}>
          {message.text}
        </Text>
      ) : null}

      <SegmentedControl
        accessibilityLabel={t('social.tabs.label')}
        options={[
          { value: 'profile', label: t('social.tabs.profile') },
          { value: 'compare', label: t('social.tabs.compare') },
        ]}
        value={tab}
        onChange={setTab}
      />

      {tab === 'profile' ? (
        <>
          <View style={styles.section}>
            <Heading>{t('profile.showcase.title')}</Heading>
            {data.showcase.length === 0 ? (
              <Caption>{t('social.showcaseEmpty', { nickname: data.nickname })}</Caption>
            ) : (
              <ShowcaseGrid
                items={data.showcase}
                width={contentWidth}
                onPressCard={(ref) => router.push({ pathname: '/card/[id]', params: { id: ref.cardId, finish: ref.finish } })}
              />
            )}
          </View>
          <View style={styles.section}>
            <Heading>{t('profile.stats.title')}</Heading>
            <StatsGrid stats={data.stats} />
          </View>
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Heading>{t('profile.badges.title')}</Heading>
              <Caption>{t('profile.badges.count', { unlocked: data.achievements.unlocked, total: data.achievements.total })}</Caption>
            </View>
            <BadgeGrid badges={recentBadges} />
          </View>
        </>
      ) : (
        <CompareView friendCode={data.friendCode} nickname={data.nickname} />
      )}

      <ReportSheet friendCode={data.friendCode} nickname={data.nickname} visible={reporting} onClose={() => setReporting(false)} />
    </ScreenContainer>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  centered: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xl },
  friendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  friendBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xxs,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xxs,
  },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
});
