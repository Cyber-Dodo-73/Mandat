import { EmptyState, ScreenContainer, type IconName } from '@/components/ui';

import { ScreenHeader } from './ScreenHeader';

type PlaceholderScreenProps = {
  title: string;
  message: string;
  icon: IconName;
  dismiss?: 'back' | 'close';
};

/** Shell for screens whose content lands in a later phase. */
export function PlaceholderScreen({ title, message, icon, dismiss }: PlaceholderScreenProps) {
  return (
    <ScreenContainer edges={['top', 'bottom']}>
      <ScreenHeader title={title} dismiss={dismiss} />
      <EmptyState icon={icon} message={message} />
    </ScreenContainer>
  );
}
