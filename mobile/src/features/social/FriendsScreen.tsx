import { router, useLocalSearchParams } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { OfflineNotice } from '@/components/navigation/OfflineNotice';
import { ScreenHeader } from '@/components/navigation/ScreenHeader';
import { CosmeticEmblem } from '@/components/profile/CosmeticEmblem';
import {
  Body,
  Button3D,
  Caption,
  Card,
  EmptyState,
  Heading,
  Icon,
  PressableScale,
  ScreenContainer,
  Sheet,
  Text,
  TextField,
} from '@/components/ui';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';

import { isFriendCode, normalizeFriendCode } from './friendCode';
import {
  useAcceptFriendMutation,
  useAddFriendMutation,
  useFriendsQuery,
  useRemoveFriendMutation,
  type Friend,
} from './queries';

/** Friends, requests and "add by friend code". `?code=` pre-fills the field (deep links). */
export function FriendsScreen() {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ code?: string }>();
  const online = useIsOnline();
  const friends = useFriendsQuery();
  const add = useAddFriendMutation();
  const accept = useAcceptFriendMutation();
  const remove = useRemoveFriendMutation();
  const [code, setCode] = useState(params.code ?? '');
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);
  const [removing, setRemoving] = useState<Friend | null>(null);

  const normalized = normalizeFriendCode(code);
  const valid = isFriendCode(normalized);

  const fail = (error: unknown) => {
    haptics.error();
    setMessage({ tone: 'danger', text: describeError(error, t) });
  };

  const onAdd = () => {
    setMessage(null);
    add.mutate(normalized, {
      onSuccess: (response) => {
        haptics.newCard();
        setCode('');
        setMessage({ tone: 'success', text: t(`friends.added.${response.result}` as 'friends.added.requested') });
      },
      onError: fail,
    });
  };

  const data = friends.data;
  const total = data?.friends.length ?? 0;

  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <ScreenHeader title={t('friends.title')} />
      {!online ? <OfflineNotice /> : null}

      <Card>
        <Heading>{t('friends.add.title')}</Heading>
        <TextField
          label={t('friends.add.label')}
          hint={t('friends.add.hint')}
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={10}
          returnKeyType="send"
          onSubmitEditing={() => valid && onAdd()}
        />
        <Button3D
          label={t('friends.add.button')}
          icon="person-add"
          fullWidth
          disabled={!valid || !online}
          loading={add.isPending}
          onPress={onAdd}
        />
        {message ? (
          <Text accessibilityRole="alert" variant="label" color={message.tone === 'success' ? colors.success : colors.danger}>
            {message.text}
          </Text>
        ) : null}
      </Card>

      {data && data.incoming.length > 0 ? (
        <View style={styles.section}>
          <Heading>{t('friends.incoming', { count: data.incoming.length })}</Heading>
          {data.incoming.map((friend) => (
            <FriendRow key={friend.friendCode} friend={friend}>
              <Button3D
                label={t('friends.accept')}
                size="sm"
                disabled={!online}
                onPress={() => accept.mutate(friend.friendCode, { onSuccess: () => haptics.newCard(), onError: fail })}
              />
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('friends.decline')}
                hitSlop={8}
                disabled={!online}
                onPress={() => remove.mutate(friend.friendCode, { onError: fail })}
              >
                <Icon name="close" size={22} tone="textMuted" />
              </PressableScale>
            </FriendRow>
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        <View style={styles.sectionHead}>
          <Heading>{t('friends.list')}</Heading>
          {data ? <Caption>{t('friends.count', { count: total, max: data.maxFriends })}</Caption> : null}
        </View>
        {!data ? (
          friends.isError ? (
            <Body tone="muted">{describeError(friends.error, t)}</Body>
          ) : (
            <Caption>{t('common.loading')}</Caption>
          )
        ) : total === 0 ? (
          <EmptyState icon="people-outline" message={t('friends.empty')} />
        ) : (
          data.friends.map((friend) => (
            <FriendRow key={friend.friendCode} friend={friend} onPress={() => router.push({ pathname: '/user/[id]', params: { id: friend.friendCode } })}>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={t('friends.remove.button', { nickname: friend.nickname })}
                hitSlop={8}
                disabled={!online}
                onPress={() => setRemoving(friend)}
              >
                <Icon name="ellipsis-horizontal" size={22} tone="textMuted" />
              </PressableScale>
            </FriendRow>
          ))
        )}
      </View>

      {data && data.outgoing.length > 0 ? (
        <View style={styles.section}>
          <Heading>{t('friends.outgoing')}</Heading>
          {data.outgoing.map((friend) => (
            <FriendRow key={friend.friendCode} friend={friend} pending>
              <Button3D
                label={t('friends.cancel')}
                variant="ghost"
                size="sm"
                disabled={!online}
                onPress={() => remove.mutate(friend.friendCode, { onError: fail })}
              />
            </FriendRow>
          ))}
        </View>
      ) : null}

      <Sheet visible={removing !== null} onClose={() => setRemoving(null)} title={t('friends.remove.title', { nickname: removing?.nickname ?? '' })}>
        <Body>{t('friends.remove.body')}</Body>
        <Button3D
          label={t('friends.remove.confirm')}
          variant="danger"
          fullWidth
          loading={remove.isPending}
          onPress={() => {
            if (!removing) return;
            remove.mutate(removing.friendCode, { onSuccess: () => setRemoving(null), onError: fail });
          }}
        />
        <Button3D label={t('friends.remove.cancel')} variant="secondary" fullWidth onPress={() => setRemoving(null)} />
      </Sheet>
    </ScreenContainer>
  );
}

function FriendRow({
  friend,
  pending = false,
  onPress,
  children,
}: {
  friend: Friend;
  pending?: boolean;
  onPress?: () => void;
  children?: ReactNode;
}) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <PressableScale
        accessibilityRole={onPress ? 'button' : undefined}
        accessibilityLabel={onPress ? t('friends.openProfile', { nickname: friend.nickname }) : friend.nickname}
        disabled={!onPress}
        onPress={onPress}
        containerStyle={styles.flex}
        style={styles.identity}
      >
        <CosmeticEmblem kind="avatar" id={friend.avatarId} size={44} />
        <View style={styles.flex}>
          <Text variant="bodyStrong" numberOfLines={1}>
            {friend.nickname}
          </Text>
          <Caption>{pending ? t('friends.pending') : friend.friendCode}</Caption>
        </View>
      </PressableScale>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
  sectionHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius,
    padding: spacing.sm,
  },
  identity: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
});
