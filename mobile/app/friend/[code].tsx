import { Redirect, useLocalSearchParams } from 'expo-router';

import { parseFriendLink } from '@/features/social/friendCode';

/** Deep link `mandat://friend/<code>`: opens that player's profile, or the friends screen if the code is invalid. */
export default function FriendLinkRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();
  const friendCode = parseFriendLink(code ?? '');
  if (!friendCode) return <Redirect href="/friends" />;
  return <Redirect href={{ pathname: '/user/[id]', params: { id: friendCode } }} />;
}
