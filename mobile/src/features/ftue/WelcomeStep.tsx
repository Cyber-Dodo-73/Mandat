import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Emblem } from '@/components/brand/Brand';
import { CosmeticEmblem } from '@/components/profile/CosmeticEmblem';
import { Body, Button3D, Caption, Heading, PressableScale, TextField, Title } from '@/components/ui';
import { useMyProfileQuery, useChangeNicknameMutation, useUpdateProfileMutation } from '@/features/profile/queries';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useReduceMotion } from '@/hooks/useReduceMotion';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';

export const STARTER_AVATARS = ['avatar.starter_1', 'avatar.starter_2', 'avatar.starter_3', 'avatar.starter_4'] as const;

type WelcomeStepProps = { onDone: () => void; onQuit: () => void };

/**
 * First screen after sign-up: a punchy welcome, the player's emblem (4 starters) and a last
 * look at the nickname. Saving is best effort: offline, the tour simply goes on.
 */
export function WelcomeStep({ onDone, onQuit }: WelcomeStepProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const reduceMotion = useReduceMotion();
  const online = useIsOnline();
  const profile = useMyProfileQuery();
  const updateProfile = useUpdateProfileMutation();
  const changeNickname = useChangeNicknameMutation();

  const current = profile.data?.profile.avatarId;
  const [avatar, setAvatar] = useState<string>(current && (STARTER_AVATARS as readonly string[]).includes(current) ? current : STARTER_AVATARS[0]);
  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);
  const shownNickname = profile.data?.profile.nickname ?? '';
  const canSave = online && profile.data !== undefined;

  const pick = (id: string) => {
    haptics.tap();
    setAvatar(id);
  };

  const saveNickname = () => {
    const next = nickname.trim();
    if (!next || next === shownNickname) {
      setEditing(false);
      return;
    }
    setError(null);
    changeNickname.mutate(next, {
      onSuccess: () => setEditing(false),
      onError: (cause) => setError(describeError(cause, t)),
    });
  };

  const start = () => {
    haptics.levelUp();
    if (canSave && avatar !== current) updateProfile.mutate((update) => ({ ...update, avatarId: avatar }));
    onDone();
  };

  const enter = (delay: number) => (reduceMotion ? undefined : FadeInDown.delay(delay).springify().damping(13));

  return (
    <Animated.View
      entering={reduceMotion ? undefined : FadeIn.duration(250)}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}
      accessibilityViewIsModal
    >
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.lg }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topRow}>
          <PressableScale accessibilityRole="button" accessibilityLabel={t('ftue.common.quit')} hitSlop={12} onPress={onQuit}>
            <Caption tone="muted">{t('ftue.common.skip')}</Caption>
          </PressableScale>
        </View>

        <Animated.View entering={enter(0)} style={styles.hero}>
          <View style={[styles.halo, { backgroundColor: `${colors.accent}33` }]}>
            <Emblem size={112} />
          </View>
          <Title align="center" accessibilityRole="header">
            {t('ftue.welcome.title')}
          </Title>
          <Body tone="muted" align="center">
            {t('ftue.welcome.subtitle')}
          </Body>
        </Animated.View>

        <Animated.View entering={enter(120)} style={styles.avatars} accessibilityRole="radiogroup">
          {STARTER_AVATARS.map((id, index) => {
            const selected = id === avatar;
            return (
              <PressableScale
                key={id}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={t('ftue.welcome.avatarA11y', { index: index + 1 })}
                onPress={() => pick(id)}
                style={[
                  styles.avatar,
                  {
                    borderColor: selected ? colors.accent : colors.border,
                    backgroundColor: selected ? `${colors.accent}22` : colors.surface,
                    borderBottomColor: selected ? colors.accentEdge : colors.neutralButtonEdge,
                  },
                ]}
              >
                <CosmeticEmblem kind="avatar" id={id} size={64} />
              </PressableScale>
            );
          })}
        </Animated.View>

        <Animated.View entering={enter(220)} style={[styles.nickname, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Caption tone="muted">{t('ftue.welcome.nicknameLabel')}</Caption>
          {editing ? (
            <>
              <TextField
                label={t('ftue.welcome.nicknameField')}
                defaultValue={shownNickname}
                onChangeText={setNickname}
                autoCapitalize="none"
                autoCorrect={false}
                maxLength={20}
                error={error}
                onSubmitEditing={saveNickname}
                returnKeyType="done"
              />
              <Button3D label={t('ftue.welcome.save')} variant="secondary" size="sm" loading={changeNickname.isPending} onPress={saveNickname} />
            </>
          ) : (
            <View style={styles.nicknameRow}>
              <Heading style={styles.nicknameText} numberOfLines={1}>
                {shownNickname || '…'}
              </Heading>
              {canSave ? (
                <Button3D label={t('ftue.welcome.edit')} variant="secondary" size="sm" onPress={() => setEditing(true)} />
              ) : null}
            </View>
          )}
        </Animated.View>

        <Animated.View entering={enter(320)}>
          <Button3D label={t('ftue.welcome.cta')} size="lg" fullWidth icon="flash" onPress={start} />
        </Animated.View>
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', gap: spacing.lg, paddingHorizontal: spacing.lg },
  topRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  hero: { alignItems: 'center', gap: spacing.sm },
  halo: { width: 156, height: 156, borderRadius: 78, alignItems: 'center', justifyContent: 'center', marginBottom: spacing.xs },
  avatars: { flexDirection: 'row', justifyContent: 'center', gap: spacing.sm, flexWrap: 'wrap' },
  avatar: {
    width: 78,
    height: 82,
    borderRadius: radius,
    borderWidth: 3,
    borderBottomWidth: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nickname: { gap: spacing.xs, padding: spacing.md, borderRadius: radius, borderWidth: 1 },
  nicknameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  nicknameText: { flex: 1 },
});
