import { router } from 'expo-router';

import { Body, Button3D, Caption, Sheet } from '@/components/ui';
import { useTranslation } from '@/i18n';
import { describeError } from '@/lib/api';
import { haptics } from '@/lib/haptics';

import { useBlockMutation } from './queries';

type BlockSheetProps = { friendCode: string; nickname: string; visible: boolean; onClose: () => void };

/** Confirms blocking a player, then leaves their profile (it is no longer visible). */
export function BlockSheet({ friendCode, nickname, visible, onClose }: BlockSheetProps) {
  const { t } = useTranslation();
  const block = useBlockMutation();

  const confirm = () => {
    block.mutate(friendCode, {
      onSuccess: () => {
        haptics.tap();
        onClose();
        if (router.canGoBack()) router.back();
      },
      onError: () => haptics.error(),
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose} title={t('social.block.title', { nickname })}>
      <Body>{t('social.block.body')}</Body>
      {block.error ? (
        <Caption tone="danger" accessibilityLiveRegion="polite">
          {describeError(block.error, t)}
        </Caption>
      ) : null}
      <Button3D
        label={t('social.block.confirm')}
        variant="danger"
        fullWidth
        loading={block.isPending}
        disabled={block.isPending}
        onPress={confirm}
      />
      <Button3D label={t('social.block.cancel')} variant="secondary" fullWidth disabled={block.isPending} onPress={onClose} />
    </Sheet>
  );
}
