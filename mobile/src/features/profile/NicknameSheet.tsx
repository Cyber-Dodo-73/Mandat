import { useState } from 'react';

import { Body, Button3D, Caption, Sheet, Text, TextField } from '@/components/ui';
import { formatDate, useLanguage, useTranslation } from '@/i18n';
import { ApiError, describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { parseInstant } from '@/lib/time';
import { useTheme } from '@/theme';

import { useChangeNicknameMutation, useMyProfileQuery } from './queries';

const NICKNAME_PATTERN = /^[\p{L}\p{N}._-]{3,20}$/u;

type NicknameSheetProps = { visible: boolean; current: string; onClose: () => void };

/** Nickname change: moderated by the server, first change free, then one every 30 days. */
export function NicknameSheet({ visible, current, onClose }: NicknameSheetProps) {
  const { t } = useTranslation();
  const language = useLanguage();
  const { colors } = useTheme();
  const profile = useMyProfileQuery();
  const change = useChangeNicknameMutation();
  const [value, setValue] = useState(current);
  const [done, setDone] = useState(false);
  // Captured once per opening: the cooldown is days long, a live clock is not needed.
  const [openedAt] = useState(() => Date.now());

  const rawAvailableAt = profile.data?.nicknameChangeAvailableAt;
  const availableAt = rawAvailableAt ? parseInstant(rawAvailableAt) : null;
  const waiting = availableAt !== null && availableAt > openedAt;
  const trimmed = value.trim();
  const valid = NICKNAME_PATTERN.test(trimmed) && trimmed !== current;
  const fieldError =
    change.error instanceof ApiError && ['nickname_taken', 'nickname_forbidden', 'validation_failed'].includes(change.error.code)
      ? describeError(change.error, t)
      : null;

  const close = () => {
    onClose();
    setTimeout(() => {
      setDone(false);
      change.reset();
    }, 300);
  };

  return (
    <Sheet visible={visible} onClose={close} title={t('profile.nickname.title')}>
      {done ? (
        <>
          <Body>{t('profile.nickname.done', { nickname: trimmed })}</Body>
          <Button3D label={t('common.close')} variant="secondary" fullWidth onPress={close} />
        </>
      ) : (
        <>
          {waiting && availableAt !== null ? (
            <Caption>{t('profile.nickname.cooldown', { date: formatDate(new Date(availableAt), language) })}</Caption>
          ) : (
            <Caption>{t('profile.nickname.rule')}</Caption>
          )}
          <TextField
            label={t('profile.nickname.label')}
            hint={t('auth.fields.nicknameHint')}
            error={fieldError}
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={20}
            editable={!waiting}
          />
          {change.error && !fieldError ? (
            <Text accessibilityRole="alert" variant="label" color={colors.danger}>
              {describeError(change.error, t)}
            </Text>
          ) : null}
          <Button3D
            label={t('profile.nickname.save')}
            fullWidth
            disabled={!valid || waiting}
            loading={change.isPending}
            onPress={() =>
              change.mutate(trimmed, {
                onSuccess: () => {
                  haptics.newCard();
                  setDone(true);
                },
                onError: () => haptics.error(),
              })
            }
          />
        </>
      )}
    </Sheet>
  );
}
