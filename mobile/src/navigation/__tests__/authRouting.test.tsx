import { Redirect, Stack } from 'expo-router';
import { renderRouter, screen, type MockContextConfig } from 'expo-router/testing-library';
import { Text } from 'react-native';

function makeRoutes(signedIn: boolean, withAuthIndex: boolean): MockContextConfig {
  const routes: Record<string, () => React.JSX.Element> = {
    _layout: () => (
      <Stack>
        <Stack.Protected guard={signedIn}>
          <Stack.Screen name="(tabs)" />
        </Stack.Protected>
        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
      </Stack>
    ),
    '(tabs)/_layout': () => <Stack />,
    '(tabs)/index': () => <Text>home</Text>,
    '(auth)/_layout': () => <Stack />,
    '(auth)/welcome': () => <Text>welcome</Text>,
    '+not-found': () => <Text>not found</Text>,
  };
  if (withAuthIndex) routes['(auth)/index'] = () => <Redirect href="/welcome" />;
  return routes;
}

describe('auth routing at launch', () => {
  it('opens home when signed in', async () => {
    await renderRouter(makeRoutes(true, true), { initialUrl: '/' });
    expect(screen.getByText('home')).toBeTruthy();
  });

  it('opens welcome (not "page not found") when signed out', async () => {
    await renderRouter(makeRoutes(false, true), { initialUrl: '/' });
    expect(screen.getByText('welcome')).toBeTruthy();
  });

  it('reproduces the bug without an (auth) index route', async () => {
    await renderRouter(makeRoutes(false, false), { initialUrl: '/' });
    expect(screen.queryByText('welcome')).toBeNull();
  });
});
