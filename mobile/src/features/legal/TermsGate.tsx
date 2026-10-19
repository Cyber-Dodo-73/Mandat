import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import { Body, Button3D, Caption, Sheet } from '@/components/ui';
import { meQueryKey, useMeQuery } from '@/features/player/queries';
import { useTranslation } from '@/i18n';
import { api, describeError, unwrap } from '@/lib/api';
import { haptics } from '@/lib/haptics';

import { ConsentCheckbox } from './LegalComponents';

/**
 * Asks a signed-in player to accept the terms again when their version changed on the server
 * (`account.needsTermsAcceptance`). The sheet cannot be dismissed without accepting.
 */
export function TermsGate() {
  const { t } = useTranslation();
  const client = useQueryClient();
  const me = useMeQuery();
  const [checked, setChecked] = useState(false);
  // Dragging the sheet away only bounces it back: remounting replays its entrance.
  const [attempt, setAttempt] = useState(0);
  const accept = useMutation({
    mutationFn: () => unwrap(api.POST('/api/v1/me/terms', { body: { ageConfirmed: true } })),
    onSuccess: () => client.invalidateQueries({ queryKey: meQueryKey }),
    onError: () => haptics.error(),
  });

  const visible = me.data?.account.needsTermsAcceptance === true;
  if (!visible) return null;

  return (
    <Sheet key={attempt} visible onClose={() => setAttempt((n) => n + 1)} title={t('legal.gate.title')}>
      <Body>{t('legal.gate.body')}</Body>
      <ConsentCheckbox checked={checked} onChange={setChecked} />
      {accept.error ? (
        <Caption tone="danger" accessibilityLiveRegion="polite">
          {describeError(accept.error, t)}
        </Caption>
      ) : null}
      <Button3D
        label={t('legal.gate.accept')}
        fullWidth
        disabled={!checked || accept.isPending}
        loading={accept.isPending}
        onPress={() => accept.mutate()}
      />
    </Sheet>
  );
}
