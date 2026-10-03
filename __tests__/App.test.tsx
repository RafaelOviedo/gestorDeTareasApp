import { act, fireEvent, render, screen } from '@testing-library/react-native';
import App from '../App';

beforeEach(() => jest.useFakeTimers());
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

function press(label: string) {
  fireEvent.press(screen.getByRole('button', { name: label }));
  act(() => jest.runAllTimers());
}

test('inicia en Login y permite ir a Registro y volver', () => {
  render(<App />);
  expect(screen.getByText('Todo en un lugar.')).toBeVisible();
  expect(screen.queryByText('Un pendiente a la vez.')).toBeNull();
  expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeDisabled();
  press('Ir al registro');
  expect(screen.getByText('Tu espacio personal.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Crear cuenta' })).toBeDisabled();
  press('Volver al login');
  expect(screen.getByText('Todo en un lugar.')).toBeVisible();
});

test('permite recorrer Home y Crear tarea sin guardar datos ni programar recordatorios', () => {
  render(<App />);
  press('Explorar demo');
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
  expect(screen.queryByText('Todo en un lugar.')).toBeNull();
  press('Crear tarea');
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), 'Repasar');
  fireEvent.press(screen.getByRole('radio', { name: '30 segundos' }));
  expect(screen.getByRole('radio', { name: '30 segundos' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Guardar tarea' })).toBeDisabled();
  press('Cancelar');
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
});

test('al salir de la demo desmonta las pantallas privadas y descarta el formulario', () => {
  render(<App />);
  press('Explorar demo');
  press('Crear tarea');
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), 'Borrador');
  press('Cancelar');
  press('Salir de la demo');
  expect(screen.getByText('Todo en un lugar.')).toBeVisible();
  expect(
    screen.queryByText('Un pendiente a la vez.', {
      includeHiddenElements: true,
    }),
  ).toBeNull();
  expect(
    screen.queryByLabelText('Título de la tarea', {
      includeHiddenElements: true,
    }),
  ).toBeNull();
  press('Explorar demo');
  press('Crear tarea');
  expect(screen.getByLabelText('Título de la tarea')).toHaveDisplayValue('');
});
