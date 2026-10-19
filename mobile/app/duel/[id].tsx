import { useLocalSearchParams } from 'expo-router';

import { DuelBoardScreen } from '@/features/duel/DuelBoardScreen';

export default function DuelRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <DuelBoardScreen duelId={id} />;
}
