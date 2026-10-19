import * as AppleAuthentication from 'expo-apple-authentication';
import { useIdTokenAuthRequest } from 'expo-auth-session/providers/google';
import * as Crypto from 'expo-crypto';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';

import { Button3D } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme';

import { signInWithApple, signInWithGoogle } from './api';

WebBrowser.maybeCompleteAuthSession();

const GOOGLE_CLIENT_IDS = {
  iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  androidClientId: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
};

const googleConfigured = Boolean(Platform.OS === 'ios' ? GOOGLE_CLIENT_IDS.iosClientId : GOOGLE_CLIENT_IDS.androidClientId);

type SocialSignInProps = {
  /** Disables the buttons while another sign-in runs. */
  busy: boolean;
  onBusyChange: (busy: boolean) => void;
  onError: (error: unknown) => void;
};

/** Sign in with Apple (iOS) and Google (only when its client ids are configured). */
export function SocialSignIn(props: SocialSignInProps) {
  const [appleAvailable, setAppleAvailable] = useState(false);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    void AppleAuthentication.isAvailableAsync().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  if (!appleAvailable && !googleConfigured) return null;
  return (
    <View style={styles.stack}>
      {appleAvailable ? <AppleButton {...props} /> : null}
      {googleConfigured ? <GoogleButton {...props} /> : null}
    </View>
  );
}

function AppleButton({ busy, onBusyChange, onError }: SocialSignInProps) {
  const { t } = useTranslation();

  const signIn = async () => {
    if (busy) return;
    haptics.tap();
    onBusyChange(true);
    try {
      // Apple receives the SHA-256 of the nonce; the API checks it against the raw value.
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });
      if (!credential.identityToken) throw new Error('Apple returned no identity token');
      await signInWithApple(credential.identityToken, rawNonce, credential.fullName?.givenName ?? null);
    } catch (error) {
      // Closing the Apple sheet is not an error worth showing.
      if ((error as { code?: string }).code !== 'ERR_REQUEST_CANCELED') onError(error);
    } finally {
      onBusyChange(false);
    }
  };

  // Custom button allowed by Apple's HIG: Apple logo + "Continue with Apple", black or white,
  // same size and 3D treatment as the other buttons of the screen.
  return (
    <Button3D
      label={t('auth.apple')}
      icon="logo-apple"
      variant="apple"
      fullWidth
      disabled={busy}
      onPress={() => void signIn()}
    />
  );
}

function GoogleButton({ busy, onBusyChange, onError }: SocialSignInProps) {
  const { t } = useTranslation();
  const [request, response, promptAsync] = useIdTokenAuthRequest(GOOGLE_CLIENT_IDS);

  useEffect(() => {
    if (response?.type !== 'success') {
      if (response) onBusyChange(false);
      return;
    }
    const idToken = response.params.id_token;
    if (!idToken) {
      onBusyChange(false);
      return;
    }
    signInWithGoogle(idToken)
      .catch(onError)
      .finally(() => onBusyChange(false));
  }, [onBusyChange, onError, response]);

  return (
    <Button3D
      label={t('auth.google')}
      icon="logo-google"
      variant="secondary"
      fullWidth
      disabled={!request || busy}
      onPress={() => {
        onBusyChange(true);
        void promptAsync().catch((error: unknown) => {
          onBusyChange(false);
          onError(error);
        });
      }}
    />
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
});
