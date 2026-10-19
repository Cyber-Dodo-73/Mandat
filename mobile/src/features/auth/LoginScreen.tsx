import { router } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';

import { Button3D, Caption, PressableScale, Text, TextField } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';

import { login } from './api';
import { AuthFormLayout } from './AuthFormLayout';
import { validateEmail } from './validation';

export function LoginScreen() {
  const { t } = useTranslation();
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSubmit = validateEmail(email) && password.length > 0 && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (cause) {
      haptics.error();
      setError(describeError(cause, t));
      setSubmitting(false);
    }
  };

  return (
    <AuthFormLayout
      title={t('auth.login.title')}
      intro={t('auth.login.intro')}
      footer={
        <>
          {error ? (
            <Caption tone="danger" accessibilityLiveRegion="polite">
              {error}
            </Caption>
          ) : null}
          <Button3D
            label={t('auth.login.submit')}
            size="lg"
            fullWidth
            loading={submitting}
            disabled={!canSubmit}
            onPress={() => void submit()}
          />
        </>
      }
    >
      <TextField
        label={t('auth.fields.email')}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        textContentType="emailAddress"
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
      />
      <TextField
        ref={passwordRef}
        label={t('auth.fields.password')}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
      <PressableScale accessibilityRole="link" hitSlop={10} onPress={() => router.push('/forgot-password')}>
        <Text variant="label" tone="accent">
          {t('auth.login.forgot')}
        </Text>
      </PressableScale>
    </AuthFormLayout>
  );
}
