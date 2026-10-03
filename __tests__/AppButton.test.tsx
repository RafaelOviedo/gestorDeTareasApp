import { fireEvent, render, screen } from '@testing-library/react-native';
import AppButton from '../src/components/AppButton';

test('el botón reutilizable responde a una pulsación y respeta el estado deshabilitado', () => {
  const onPress = jest.fn();
  const { rerender } = render(
    <AppButton title="Continuar" onPress={onPress} />,
  );
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  expect(onPress).toHaveBeenCalledTimes(1);
  rerender(<AppButton title="Continuar" onPress={onPress} disabled />);
  fireEvent.press(screen.getByRole('button', { name: 'Continuar' }));
  expect(onPress).toHaveBeenCalledTimes(1);
});
