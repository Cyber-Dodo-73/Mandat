import type { Edge } from 'react-native-safe-area-context';

import { EmptyState, ScreenContainer, type IconName } from '@/components/ui';

import { ScreenHeader } from './ScreenHeader';

type PlaceholderScreenProps = {
  title: string;
  message: string;
  icon: IconName;
  dismiss?: 'back' | 'close';
  edges?: readonly Edge[];
};

/** Shell for screens whose content lands in a later phase. */
export function PlaceholderScreen({ title, message, icon, dismiss, edges = ['top', 'bottom'] }: PlaceholderScreenProps) {
  return (
    <ScreenContainer edges={edges}>
      <ScreenHeader title={title} dismiss={dismiss} />
      <EmptyState icon={icon} message={message} />
    </ScreenContainer>
  );
}
