import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button3D, Text } from '@/components/ui';
import { useOwnedCopies } from '@/features/collection/queries';
import { useIsOnline } from '@/hooks/useIsOnline';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';
import { spacing, useTheme } from '@/theme';
import type { Card } from '@/types/card';

import { useMyProfileQuery, useUpdateProfileMutation } from './queries';
import { byBestFinish, sameRef, toggleShowcase, type CardRef } from './showcase';

/**
 * "Add to showcase" and "Set as favorite" from a card's detail. Uses the most special finish the
 * player owns; only owned cards can be shown (the server checks it too).
 */
export function ProfileCardActions({ card }: { card: Card }) {
  const { t } = useTranslation();
  const { colors } = useTheme();
  const online = useIsOnline();
  const copies = useOwnedCopies(card.id);
  const profile = useMyProfileQuery();
  const update = useUpdateProfileMutation();
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null);

  const best = [...copies].sort(byBestFinish)[0];
  if (!best) return null;

  const showcase = profile.data?.profile.showcase ?? [];
  const favorite = profile.data?.profile.favoriteCard;
  const shownRef = showcase.find((entry) => entry.cardId === card.id);
  const ref: CardRef = shownRef ?? { cardId: card.id, finish: best.finish };
  const inShowcase = Boolean(shownRef);
  const isFavorite = favorite?.cardId === card.id;
  const disabled = !online || !profile.data || update.isPending;

  const run = (change: Parameters<typeof update.mutate>[0], success: string) => {
    setMessage(null);
    update.mutate(change, {
      onSuccess: () => {
        haptics.toggle();
        setMessage({ tone: 'success', text: success });
      },
      onError: (error) => {
        haptics.error();
        setMessage({ tone: 'danger', text: describeError(error, t) });
      },
    });
  };

  const onShowcase = () => {
    const result = toggleShowcase(showcase, ref);
    if (result.result === 'full') {
      haptics.error();
      setMessage({ tone: 'danger', text: t('profile.showcase.full') });
      return;
    }
    run(
      (current) => ({ ...current, showcase: result.showcase }),
      result.result === 'added' ? t('profile.cardActions.addedToShowcase') : t('profile.cardActions.removedFromShowcase'),
    );
  };

  const onFavorite = () => {
    run(
      (current) => ({ ...current, favoriteCard: isFavorite && sameRef(current.favoriteCard, favorite) ? undefined : ref }),
      isFavorite ? t('profile.cardActions.favoriteCleared') : t('profile.cardActions.favoriteSet'),
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Button3D
            label={inShowcase ? t('profile.cardActions.removeFromShowcase') : t('profile.cardActions.addToShowcase')}
            icon={inShowcase ? 'albums' : 'albums-outline'}
            variant="secondary"
            size="sm"
            fullWidth
            disabled={disabled}
            onPress={onShowcase}
          />
        </View>
        <View style={styles.flex}>
          <Button3D
            label={isFavorite ? t('profile.cardActions.favorite') : t('profile.cardActions.setFavorite')}
            icon={isFavorite ? 'star' : 'star-outline'}
            variant="secondary"
            size="sm"
            fullWidth
            disabled={disabled}
            onPress={onFavorite}
          />
        </View>
      </View>
      {message ? (
        <Text accessibilityRole="alert" variant="label" color={message.tone === 'success' ? colors.success : colors.danger}>
          {message.text}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.xs },
  row: { flexDirection: 'row', gap: spacing.sm },
  flex: { flex: 1 },
});
