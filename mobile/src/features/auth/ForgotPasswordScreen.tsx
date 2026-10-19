import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button3D, Caption, TextField } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';

import { requestPasswordReset } from './api';
import { AuthFormLayout } from './AuthFormLayout';
import { validateEmail } from './validation';

/** Asks for a reset link; the new password is chosen on the web page the email links to. */
export function ForgotPasswordScreen() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = validateEmail(email) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await requestPasswordReset(email.trim());
      haptics.tap();
      setSent(true);
    } catch (cause) {
      haptics.error();
      setError(describeError(cause, t));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthFormLayout
      title={t('auth.forgot.title')}
      intro={t('auth.forgot.intro')}
      footer={
        <>
          {error ? (
            <Caption tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Caption>
          ) : null}
          {sent ? (
            <Button3D label={t('auth.forgot.back')} size="lg" fullWidth onPress={() => router.back()} />
          ) : (
            <Button3D
              label={t('auth.forgot.submit')}
              size="lg"
              fullWidth
              loading={submitting}
              disabled={!canSubmit}
              onPress={() => void submit()}
            />
          )}
        </>
      }
    >
      {sent ? (
        <Body accessibilityLiveRegion="polite">{t('auth.forgot.sent')}</Body>
      ) : (
        <TextField
          label={t('auth.fields.email')}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          returnKeyType="send"
          onSubmitEditing={() => void submit()}
        />
      )}
    </AuthFormLayout>
  );
}
