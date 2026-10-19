import { Redirect } from 'expo-router';

import { useSettingsStore } from '@/features/settings/store';

/**
 * Signed-out entry for "/". The home tab owns "/" too but is protected, so without this
 * route a signed-out launch resolves nothing and shows "page not found". First launch
 * goes through the intro, then the welcome screen.
 */
export default function AuthIndex() {
  const onboardingSeen = useSettingsStore((state) => state.onboardingSeen);
  return <Redirect href={onboardingSeen ? '/welcome' : '/onboarding'} />;
}
