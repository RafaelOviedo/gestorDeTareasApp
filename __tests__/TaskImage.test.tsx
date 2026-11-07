import { fireEvent, render, screen } from '@testing-library/react-native';
import TaskImage from '../src/components/TaskImage';

test('muestra un mensaje si falta la foto y recupera la vista al reemplazarla', () => {
  const view = render(<TaskImage path="task-images/1.jpg" title="Repasar" />);
  fireEvent(screen.getByLabelText('Foto de la tarea: Repasar'), 'error', { nativeEvent: { error: 'missing file' } });
  expect(screen.getByText('No se pudo mostrar la foto. Podés reemplazarla desde el detalle.')).toBeVisible();
  view.rerender(<TaskImage path="task-images/2.jpg" title="Repasar" />);
  expect(screen.getByLabelText('Foto de la tarea: Repasar')).toBeVisible();
});
