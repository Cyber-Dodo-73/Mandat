import { fireEvent, render, screen } from '@testing-library/react-native';

import { haptics } from '@/lib/haptics';
import { playSound } from '@/lib/sounds';

import { Button3D } from '../Button3D';

jest.mock('@/lib/haptics', () => ({ haptics: { tap: jest.fn() } }));
jest.mock('@/lib/sounds', () => ({ playSound: jest.fn() }));

describe('Button3D', () => {
  beforeEach(() => jest.clearAllMocks());

  it('fires haptic, sound and onPress when pressed', async () => {
    const onPress = jest.fn();
    await render(<Button3D label="Ouvrir" onPress={onPress} />);

    const button = screen.getByRole('button', { name: 'Ouvrir' });
    await fireEvent(button, 'pressIn');
    await fireEvent.press(button);

    expect(haptics.tap).toHaveBeenCalled();
    expect(playSound).toHaveBeenCalledWith('tap');
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('ignores presses while disabled', async () => {
    const onPress = jest.fn();
    await render(<Button3D label="Ouvrir" onPress={onPress} disabled />);

    const button = screen.getByRole('button', { name: 'Ouvrir', disabled: true });
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
  });
});
