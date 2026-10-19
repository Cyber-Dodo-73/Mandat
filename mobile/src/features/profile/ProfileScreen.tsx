import { router } from 'expo-router';
import { useMemo, useRef, useState, type ComponentRef } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';

import { CARD_WIDTHS, TradingCard } from '@/components/cards';
import { OfflineNotice } from '@/components/navigation/OfflineNotice';
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
  Text,
  Title,
  Toggle,
} from '@/components/ui';
import { getCard } from '@/data/catalog';
import { useFriendsQuery } from '@/features/social/queries';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useLanguage, useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { spacing, useTheme } from '@/theme';

import { toBadges } from './badges';
import { CardPickerSheet } from './CardPickerSheet';
import { CosmeticPickerSheet, type PickerKind } from './CosmeticPickerSheet';
import { DEFAULT_AVATAR, DEFAULT_BANNER } from './cosmetics';
import { useMyProfileQuery, useProfileAchievementsQuery, useUpdateProfileMutation } from './queries';
import { copyFriendCode, shareFriendLink, shareProfileImage } from './share';
import { toggleShowcase, type CardRef } from './showcase';

const BADGE_PREVIEW = 18;

/** The player's own profile: identity, favorite card, showcase, stats and badges, all editable. */
export function ProfileScreen() {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const online = useIsOnline();
  const profileQuery = useMyProfileQuery();
  const achievements = useProfileAchievementsQuery();
  const friends = useFriendsQuery();
  const update = useUpdateProfileMutation();
  const shareRef = useRef<ComponentRef<typeof View>>(null);
  const [picker, setPicker] = useState<PickerKind | null>(null);
  const [cardPicker, setCardPicker] = useState<'showcase' | 'favorite' | null>(null);
  const [allBadges, setAllBadges] = useState(false);
  const [notice, setNotice] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const contentWidth = width - spacing.md * 2;
  const data = profileQuery.data;
  const profile = data?.profile;
  const badges = useMemo(() => toBadges(achievements.data?.achievements ?? []), [achievements.data]);
  const incoming = friends.data?.incoming.length ?? 0;

  const save = (change: Parameters<typeof update.mutate>[0], success?: string) => {
    setNotice(null);
    update.mutate(change, {
      onSuccess: () => {
        if (success) setNotice({ tone: 'success', text: success });
      },
      onError: (error) => {
        haptics.error();
        setNotice({ tone: 'danger', text: describeError(error, t) });
      },
    });
  };

  const onToggleShowcase = (ref: CardRef) => {
    if (!profile) return;
    const result = toggleShowcase(profile.showcase, ref);
    if (result.result === 'full') {
      haptics.error();
      setNotice({ tone: 'danger', text: t('profile.showcase.full') });
      return;
    }
    save((current) => ({ ...current, showcase: result.showcase }));
  };

  const pickerOptions = (kind: PickerKind): string[] => {
    if (!data) return [];
    if (kind === 'avatar') return data.unlocks.avatars;
    if (kind === 'banner') return data.unlocks.banners;
    return data.unlocks.titles;
  };

  const pickerSelected = (kind: PickerKind | null) => {
    if (!profile || !kind) return null;
    return kind === 'avatar' ? profile.avatarId : kind === 'banner' ? profile.bannerId : profile.titleId;
  };

  const onPick = (id: string | null) => {
    const kind = picker;
    setPicker(null);
    if (!kind) return;
    save((current) => {
      if (kind === 'avatar') return { ...current, avatarId: id ?? DEFAULT_AVATAR };
      if (kind === 'banner') return { ...current, bannerId: id ?? DEFAULT_BANNER };
      return { ...current, titleId: id };
    });
  };

  const onCopy = async () => {
    if (!profile) return;
    const copied = await copyFriendCode(profile.friendCode);
    if (copied) haptics.toggle();
    setNotice(copied ? { tone: 'success', text: t('profile.actions.copied') } : { tone: 'danger', text: t('errors.generic') });
  };

  const onShareImage = async () => {
    try {
      await shareProfileImage(shareRef, t('profile.actions.shareImage'));
    } catch (error) {
      setNotice({ tone: 'danger', text: describeError(error, t) });
    }
  };

  if (!data || !profile) {
    return (
      <ScreenContainer>
        <TopBar incoming={incoming} />
        {profileQuery.isError ? (
          <View style={styles.centered}>
            <EmptyState icon="person-outline" message={describeError(profileQuery.error, t)} />
            <Button3D label={t('common.retry')} variant="secondary" onPress={() => void profileQuery.refetch()} />
          </View>
        ) : (
          <EmptyState icon="person-outline" message={t('common.loading')} />
        )}
      </ScreenContainer>
    );
  }

  const favoriteCard = profile.favoriteCard ? getCard(profile.favoriteCard.cardId) : undefined;

  return (
    <ScreenContainer>
      <TopBar incoming={incoming} />
      {!online ? <OfflineNotice message={t('profile.offline')} /> : null}

      {/* Everything inside this view is what the shared image shows. */}
      <View ref={shareRef} collapsable={false} style={[styles.shareable, { backgroundColor: colors.background }]}>
        <ProfileHeader
          width={contentWidth}
          nickname={profile.nickname}
          friendCode={profile.friendCode}
          avatarId={profile.avatarId}
          bannerId={profile.bannerId}
          titleId={profile.titleId}
          codeLabel={t('profile.friendCode')}
          onPressAvatar={online ? () => setPicker('avatar') : undefined}
          onPressBanner={online ? () => setPicker('banner') : undefined}
          onPressTitle={online ? () => setPicker('title') : undefined}
          accessibilityHintAvatar={t('profile.picker.avatarHint')}
          accessibilityHintBanner={t('profile.picker.bannerHint')}
        />

        <View style={styles.favorite}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={t('profile.favorite.title')}
            accessibilityHint={t('profile.favorite.hint')}
            disabled={!online}
            onPress={() => setCardPicker('favorite')}
          >
            {favoriteCard && profile.favoriteCard ? (
              <TradingCard card={favoriteCard} finish={profile.favoriteCard.finish} size="large" width={CARD_WIDTHS.large * 0.62} />
            ) : (
              <View style={[styles.favoriteEmpty, { borderColor: colors.border, width: CARD_WIDTHS.large * 0.62 }]}>
                <Icon name="star-outline" size={28} tone="textMuted" />
                <Caption align="center">{t('profile.favorite.empty')}</Caption>
              </View>
            )}
          </PressableScale>
          <View style={styles.favoriteText}>
            <Text variant="caption" tone="accent">
              {t('profile.favorite.title')}
            </Text>
            <Heading numberOfLines={2}>{favoriteCard ? favoriteCard.name[language] : t('profile.favorite.none')}</Heading>
            <Caption>{t('profile.stats.collection', { count: profile.stats.distinctCards, total: profile.stats.seasonCards })}</Caption>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.sectionHead}>
            <Heading>{t('profile.showcase.title')}</Heading>
            <Caption>{t('profile.showcase.count', { count: profile.showcase.length })}</Caption>
          </View>
          {profile.showcase.length === 0 && !online ? (
            <Body tone="muted">{t('profile.showcase.empty')}</Body>
          ) : (
            <ShowcaseGrid
              items={profile.showcase}
              width={contentWidth}
              editable={online}
              onReorder={(showcase) => save((current) => ({ ...current, showcase }))}
              onPressCard={(ref) => router.push({ pathname: '/card/[id]', params: { id: ref.cardId, finish: ref.finish } })}
              onPressEmpty={() => setCardPicker('showcase')}
            />
          )}
          {online && profile.showcase.length > 1 ? <Caption>{t('profile.showcase.reorderHint')}</Caption> : null}
        </View>
      </View>

      {/* Two by two, full-width cells: labels never truncate. */}
      <View style={styles.actions}>
        <View style={styles.actionCell}>
          <Button3D label={t('profile.actions.editShowcase')} icon="albums" variant="secondary" size="sm" fullWidth disabled={!online} onPress={() => setCardPicker('showcase')} />
        </View>
        <View style={styles.actionCell}>
          <Button3D label={t('profile.actions.copyCode')} icon="copy" variant="secondary" size="sm" fullWidth onPress={() => void onCopy()} />
        </View>
        <View style={styles.actionCell}>
          <Button3D label={t('profile.actions.shareLink')} icon="person-add" variant="brand" size="sm" fullWidth onPress={() => void shareFriendLink(profile.friendCode, t('profile.actions.shareMessage', { nickname: profile.nickname }))} />
        </View>
        <View style={styles.actionCell}>
          <Button3D label={t('profile.actions.shareImage')} icon="share-social" variant="primary" size="sm" fullWidth onPress={() => void onShareImage()} />
        </View>
      </View>

      {notice ? (
        <Text accessibilityRole="alert" variant="label" color={notice.tone === 'success' ? colors.success : colors.danger}>
          {notice.text}
        </Text>
      ) : null}

      <View style={styles.section}>
        <Heading>{t('profile.stats.title')}</Heading>
        <StatsGrid stats={profile.stats} />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Heading>{t('profile.badges.title')}</Heading>
          <Caption>{t('profile.badges.count', { unlocked: profile.achievements.unlocked, total: profile.achievements.total })}</Caption>
        </View>
        <BadgeGrid badges={badges} limit={allBadges ? undefined : BADGE_PREVIEW} />
        {badges.length > BADGE_PREVIEW ? (
          <Button3D
            label={allBadges ? t('profile.badges.showLess') : t('profile.badges.showAll')}
            variant="ghost"
            size="sm"
            onPress={() => setAllBadges((value) => !value)}
          />
        ) : null}
      </View>

      <View style={[styles.privacy, { borderColor: colors.border }]}>
        <Icon name={data.visibility === 'private' ? 'lock-closed-outline' : 'earth-outline'} tone="textMuted" />
        <View style={styles.flex}>
          <Text variant="bodyStrong">{t('profile.visibility.label')}</Text>
          <Caption>{data.visibility === 'private' ? t('profile.visibility.privateHint') : t('profile.visibility.publicHint')}</Caption>
        </View>
        <Toggle
          value={data.visibility === 'private'}
          accessibilityLabel={t('profile.visibility.label')}
          onValueChange={(isPrivate) => save((current) => ({ ...current, visibility: isPrivate ? 'private' : 'public' }))}
        />
      </View>

      <CosmeticPickerSheet
        kind={picker}
        options={picker ? pickerOptions(picker) : []}
        selected={pickerSelected(picker)}
        onSelect={onPick}
        onClose={() => setPicker(null)}
      />
      <CardPickerSheet
        mode={cardPicker}
        showcase={profile.showcase}
        favorite={profile.favoriteCard}
        onToggleShowcase={onToggleShowcase}
        onPickFavorite={(ref) => {
          setCardPicker(null);
          save((current) => ({ ...current, favoriteCard: ref ?? undefined }));
        }}
        onClose={() => setCardPicker(null)}
      />
    </ScreenContainer>
  );
}

function TopBar({ incoming }: { incoming: number }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={styles.topBar}>
      <Title style={styles.flex}>{t('profile.title')}</Title>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={incoming > 0 ? t('friends.openWithRequests', { count: incoming }) : t('friends.open')}
        hitSlop={12}
        onPress={() => router.push('/friends')}
      >
        <Icon name="people-outline" size={26} tone="textMuted" />
        {incoming > 0 ? <View style={[styles.dot, { backgroundColor: colors.accent }]} /> : null}
      </PressableScale>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={t('profile.settingsButton')}
        hitSlop={12}
        onPress={() => router.push('/settings')}
      >
        <Icon name="settings-outline" size={26} tone="textMuted" />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  flex: { flex: 1 },
  centered: { alignItems: 'center', gap: spacing.md },
  shareable: { gap: spacing.lg, paddingBottom: spacing.sm },
  favorite: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  favoriteEmpty: {
    aspectRatio: 63 / 88,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
  },
  favoriteText: { flex: 1, gap: spacing.xxs },
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  actionCell: { flexBasis: '48%', flexGrow: 1 },
  privacy: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.md,
  },
  dot: { position: 'absolute', top: -2, right: -2, width: 10, height: 10, borderRadius: 5 },
});
