import { Redirect } from 'expo-router';

import { CardGalleryScreen } from '@/features/dev/CardGalleryScreen';

/** Card gallery for development only: production builds redirect home. */
export default function DevCardsRoute() {
  if (!__DEV__) return <Redirect href="/" />;
  return <CardGalleryScreen />;
}
