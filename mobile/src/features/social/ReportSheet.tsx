import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button3D, Icon, PressableScale, Sheet, Text, TextField } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { radius, spacing, useTheme } from '@/theme';

import { REPORT_REASONS, useReportMutation, type ReportReason } from './queries';

const NOTE_MAX = 280;

type ReportSheetProps = { friendCode: string; nickname: string; visible: boolean; onClose: () => void };

/** "Report this profile": a reason, an optional private note, then a confirmation. */
export function ReportSheet({ friendCode, nickname, visible, onClose }: ReportSheetProps) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const report = useReportMutation();
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [note, setNote] = useState('');
  const [sent, setSent] = useState(false);

  const close = () => {
    onClose();
    // Reset once the sheet has slid away.
    setTimeout(() => {
      setReason(null);
      setNote('');
      setSent(false);
      report.reset();
    }, 300);
  };

  const send = () => {
    if (!reason) return;
    report.mutate(
      { friendCode, reason, note },
      {
        onSuccess: () => {
          haptics.missionComplete();
          setSent(true);
        },
        onError: () => haptics.error(),
      },
    );
  };

  return (
    <Sheet visible={visible} onClose={close} title={t('report.title', { nickname })}>
      {sent ? (
        <>
          <View style={styles.done}>
            <Icon name="shield-checkmark" size={36} tone="success" />
            <Body align="center">{t('report.sent')}</Body>
          </View>
          <Button3D label={t('common.close')} variant="secondary" fullWidth onPress={close} />
        </>
      ) : (
        <>
          <Body tone="muted">{t('report.intro')}</Body>
          <View style={styles.reasons} accessibilityRole="radiogroup">
            {REPORT_REASONS.map((value) => {
              const selected = value === reason;
              return (
                <PressableScale
                  key={value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  haptic="toggle"
                  onPress={() => setReason(value)}
                  style={[
                    styles.reason,
                    { backgroundColor: colors.surfaceRaised, borderColor: selected ? colors.accent : 'transparent' },
                  ]}
                >
                  <Icon name={selected ? 'radio-button-on' : 'radio-button-off'} size={20} tone={selected ? 'accent' : 'textMuted'} />
                  <Text variant="bodyStrong">{t(`report.reasons.${value}` as 'report.reasons.other')}</Text>
                </PressableScale>
              );
            })}
          </View>
          <TextField
            label={t('report.noteLabel')}
            hint={t('report.noteHint', { max: NOTE_MAX })}
            value={note}
            onChangeText={(text) => setNote(text.slice(0, NOTE_MAX))}
            multiline
            maxLength={NOTE_MAX}
          />
          {report.error ? (
            <Text accessibilityRole="alert" variant="label" color={colors.danger}>
              {describeError(report.error, t)}
            </Text>
          ) : null}
          <Button3D label={t('report.send')} variant="danger" fullWidth disabled={!reason} loading={report.isPending} onPress={send} />
        </>
      )}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  reasons: { gap: spacing.xs },
  reason: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderWidth: 2,
    borderRadius: radius,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  done: { alignItems: 'center', gap: spacing.sm, paddingVertical: spacing.md },
});
