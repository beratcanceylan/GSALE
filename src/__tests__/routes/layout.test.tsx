import { describe, expect, test } from 'bun:test';

import { nativeState, resetNativeState } from '../../../test-support/native-mocks';
import { allOfType, byLabel, fire, render } from '../../../test-support/render';

const RootLayout = (await import('../../../app/_layout')).default;
const NotificationsScreen = (await import('../../../app/notifications')).default;

describe('app navigation shell', () => {
  test('registers the root screens inside the app background', async () => {
    const view = await render(<RootLayout />);
    expect(allOfType(view.root, 'Stack.Screen').map((screen) => String(screen.props['name']))).toEqual([
      '(tabs)', 'game/[id]', 'notifications',
    ]);
    await view.unmount();
  });

  test('notification back control returns to the previous route', async () => {
    resetNativeState();
    const view = await render(<NotificationsScreen />);
    expect(view.text()).toContain('bildirimleri yakında geliyor');
    await fire(byLabel(view.root, 'Geri dön'), 'onPress');
    expect(nativeState.router.back).toBe(1);
    await view.unmount();
  });
});
