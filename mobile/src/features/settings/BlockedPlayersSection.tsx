import { StyleSheet, View } from 'react-native';

import { Button3D, Caption, Card, SectionHeader, SettingRow } from '@/components/ui';
import { useBlocksQuery, useUnblockMutation } from '@/features/social/queries';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { spacing } from '@/theme';

/** Players I blocked, with an unblock button each. */
export function BlockedPlayersSection() {
  const { t } = useTranslation();
  const blocks = useBlocksQuery();
  const unblock = useUnblockMutation();
  const players = blocks.data ?? [];

  return (
    <View style={styles.section}>
      <SectionHeader title={t('settings.blocked.title')} />
      <Card>
        {players.length === 0 ? (
          <Caption>{blocks.isPending ? t('common.loading') : t('settings.blocked.empty')}</Caption>
        ) : (
          players.map((player) => (
            <SettingRow
              key={player.friendCode}
              icon="ban-outline"
              label={player.nickname}
              control={
                <Button3D
                  label={t('settings.blocked.unblock')}
                  accessibilityHint={t('settings.blocked.unblockA11y', { nickname: player.nickname })}
                  variant="secondary"
                  size="sm"
                  disabled={unblock.isPending}
                  onPress={() => unblock.mutate(player.friendCode)}
                />
              }
            />
          ))
        )}
        {unblock.error ? (
          <Caption tone="danger" accessibilityLiveRegion="polite">
            {describeError(unblock.error, t)}
          </Caption>
        ) : null}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.sm },
});
