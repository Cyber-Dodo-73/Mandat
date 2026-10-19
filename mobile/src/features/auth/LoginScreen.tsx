import { useRef, useState, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';

import { Button3D, Caption, TextField } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { errorMessageKey } from '@/lib/api';
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
      setError(t(errorMessageKey(cause)));
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
    </AuthFormLayout>
  );
}
