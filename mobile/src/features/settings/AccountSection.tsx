import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Body, Button3D, Caption, Card, SectionHeader, SettingRow, Sheet } from '@/components/ui';
import { deleteAccount, logout } from '@/features/auth/api';
import { useMeQuery } from '@/features/player/queries';
import { useTranslation } from '@/i18n';
import { errorMessageKey } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { spacing } from '@/theme';

/** Who is signed in, sign out, and permanent account deletion (store requirement). */
export function AccountSection() {
  const { t } = useTranslation();
  const me = useMeQuery();
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [busy, setBusy] = useState<'logout' | 'delete' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const account = me.data?.account;

  const run = async (action: 'logout' | 'delete') => {
    setBusy(action);
    setError(null);
    try {
      await (action === 'logout' ? logout() : deleteAccount());
    } catch (cause) {
      haptics.error();
      setError(t(errorMessageKey(cause)));
      setBusy(null);
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader title={t('settings.account')} />
      <Card>
        <SettingRow
          icon="person-circle-outline"
          label={account?.nickname ?? t('common.loading')}
          hint={account ? t('settings.accountInfo.friendCode', { code: account.friendCode }) : undefined}
        />
        {account?.email ? <SettingRow icon="mail-outline" label={account.email} /> : null}
        <Button3D
          label={t('settings.accountInfo.logout')}
          icon="log-out-outline"
          variant="secondary"
          fullWidth
          loading={busy === 'logout'}
          disabled={busy !== null}
          onPress={() => void run('logout')}
        />
        <Button3D
          label={t('settings.accountInfo.delete.button')}
          variant="ghost"
          size="sm"
          disabled={busy !== null}
          onPress={() => setConfirmVisible(true)}
        />
      </Card>

      <Sheet
        visible={confirmVisible}
        onClose={() => setConfirmVisible(false)}
        title={t('settings.accountInfo.delete.title')}
      >
        <Body>{t('settings.accountInfo.delete.body')}</Body>
        {error ? (
          <Caption tone="danger" accessibilityLiveRegion="polite">
            {error}
          </Caption>
        ) : null}
        <Button3D
          label={t('settings.accountInfo.delete.confirm')}
          variant="danger"
          fullWidth
          loading={busy === 'delete'}
          disabled={busy !== null}
          onPress={() => void run('delete')}
        />
        <Button3D
          label={t('settings.accountInfo.delete.cancel')}
          variant="secondary"
          fullWidth
          disabled={busy === 'delete'}
          onPress={() => setConfirmVisible(false)}
        />
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
