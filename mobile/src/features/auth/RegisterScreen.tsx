import { useRef, useState, type ComponentRef } from 'react';
import type { TextInput } from 'react-native';

import { Button3D, Caption, TextField } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { ApiError, describeError, errorMessageKey } from '@/lib/api';
import { haptics } from '@/lib/haptics';

import { register } from './api';
import { AuthFormLayout } from './AuthFormLayout';
import {
  fieldForErrorCode,
  PASSWORD_MIN_LENGTH,
  validateEmail,
  validateNickname,
  validatePassword,
  type AuthField,
} from './validation';

type FieldErrors = Partial<Record<AuthField, string>>;

export function RegisterScreen() {
  const { t } = useTranslation();
  const emailRef = useRef<ComponentRef<typeof TextInput>>(null);
  const passwordRef = useRef<ComponentRef<typeof TextInput>>(null);
  const [nickname, setNickname] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const localErrors = (): FieldErrors => ({
    ...(validateNickname(nickname) ? {} : { nickname: t('auth.fields.nicknameInvalid') }),
    ...(validateEmail(email) ? {} : { email: t('auth.fields.emailInvalid') }),
    ...(validatePassword(password) ? {} : { password: t('auth.fields.passwordInvalid', { count: PASSWORD_MIN_LENGTH }) }),
  });

  const submit = async () => {
    if (submitting) return;
    const errors = localErrors();
    setFieldErrors(errors);
    setFormError(null);
    if (Object.keys(errors).length > 0) {
      haptics.error();
      return;
    }
    setSubmitting(true);
    try {
      await register({ nickname: nickname.trim(), email: email.trim(), password });
    } catch (cause) {
      haptics.error();
      const field = cause instanceof ApiError ? fieldForErrorCode(cause.code) : null;
      if (field) setFieldErrors({ [field]: t(errorMessageKey(cause)) });
      else setFormError(describeError(cause, t));
      setSubmitting(false);
    }
  };

  return (
    <AuthFormLayout
      title={t('auth.register.title')}
      intro={t('auth.register.intro')}
      footer={
        <>
          {formError ? (
            <Caption tone="danger" accessibilityLiveRegion="polite">
              {formError}
            </Caption>
          ) : null}
          <Button3D
            label={t('auth.register.submit')}
            size="lg"
            fullWidth
            loading={submitting}
            disabled={submitting}
            onPress={() => void submit()}
          />
        </>
      }
    >
      <TextField
        label={t('auth.fields.nickname')}
        hint={t('auth.fields.nicknameHint')}
        error={fieldErrors.nickname}
        value={nickname}
        onChangeText={setNickname}
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="nickname"
        maxLength={20}
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
      />
      <TextField
        ref={emailRef}
        label={t('auth.fields.email')}
        error={fieldErrors.email}
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
        hint={t('auth.fields.passwordHint', { count: PASSWORD_MIN_LENGTH })}
        error={fieldErrors.password}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        maxLength={128}
        returnKeyType="go"
        onSubmitEditing={() => void submit()}
      />
    </AuthFormLayout>
  );
}
