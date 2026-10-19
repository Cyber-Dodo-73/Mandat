import { Redirect } from 'expo-router';

/**
 * Signed-out entry for "/". The home tab owns "/" too but is protected, so without this
 * route a signed-out launch resolves nothing and shows "page not found".
 */
export default function AuthIndex() {
  return <Redirect href="/welcome" />;
}
