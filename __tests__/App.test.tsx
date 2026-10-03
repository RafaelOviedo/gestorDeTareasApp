import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { registerUser, USERS_STORAGE_KEY } from '../src/services/auth';

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: label }));
  });
  act(() => jest.runAllTimers());
}

function fillCredentials(username: string, password: string) {
  fireEvent.changeText(screen.getByLabelText('Usuario'), username);
  fireEvent.changeText(screen.getByLabelText('Contraseña'), password);
}

test('Login bloquea campos vacíos y credenciales incorrectas sin acceso de demo', async () => {
  render(<App />);
  expect(screen.queryByRole('button', { name: 'Explorar demo' })).toBeNull();
  await press('Iniciar sesión');
  expect(screen.getByText('Ingresá un nombre de usuario.')).toBeVisible();
  fillCredentials('Ana', '');
  await press('Iniciar sesión');
  expect(screen.getByText('Ingresá una contraseña.')).toBeVisible();
  fillCredentials('Ana', 'incorrecta');
  await press('Iniciar sesión');
  expect(screen.getByText('Usuario o contraseña incorrectos.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Crear tarea' })).toBeNull();
});

test('registra una cuenta, vuelve a Login y solo permite acceder con la contraseña correcta', async () => {
  render(<App />);
  await press('Ir al registro');
  fillCredentials('Ana', 'Clave');
  await press('Crear cuenta');
  expect(
    screen.getByText('Cuenta creada. Iniciá sesión con tu contraseña.'),
  ).toBeVisible();
  expect(screen.getByLabelText('Usuario')).toHaveDisplayValue('Ana');
  expect(screen.getByLabelText('Contraseña')).toHaveDisplayValue('');
  expect(screen.queryByRole('button', { name: 'Crear tarea' })).toBeNull();
  fillCredentials('ana', 'incorrecta');
  await press('Iniciar sesión');
  expect(screen.getByText('Usuario o contraseña incorrectos.')).toBeVisible();
  fillCredentials('ANA', 'Clave');
  await press('Iniciar sesión');
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
  expect(
    screen.queryByText('Todo en un lugar.', { includeHiddenElements: true }),
  ).toBeNull();
  await press('Crear tarea');
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), 'Repasar');
  fireEvent.press(screen.getByRole('radio', { name: '30 segundos' }));
  expect(screen.getByRole('radio', { name: '30 segundos' })).toBeChecked();
  expect(screen.getByRole('button', { name: 'Guardar tarea' })).toBeEnabled();
  await press('Cancelar');
  await press('Cerrar sesión');
  expect(screen.getByText('Todo en un lugar.')).toBeVisible();
  expect(
    screen.queryByText('Hola, Ana.', { includeHiddenElements: true }),
  ).toBeNull();
  expect(
    screen.queryByLabelText('Título de la tarea', {
      includeHiddenElements: true,
    }),
  ).toBeNull();
  expect(screen.getByLabelText('Contraseña')).toHaveDisplayValue('');
});

test('al remontar la app pide login y conserva las cuentas guardadas', async () => {
  await registerUser('Ana', 'Clave');
  const app = render(<App />);
  fillCredentials('Ana', 'Clave');
  await press('Iniciar sesión');
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
  app.unmount();
  render(<App />);
  expect(screen.getByText('Todo en un lugar.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Crear tarea' })).toBeNull();
  fillCredentials('Ana', 'Clave');
  await press('Iniciar sesión');
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
});

test('muestra duplicados en Registro y permite volver sin iniciar sesión', async () => {
  await registerUser('Ana', 'Clave');
  render(<App />);
  await press('Ir al registro');
  fillCredentials(' ANA ', 'otra');
  await press('Crear cuenta');
  expect(
    screen.getByText('Ese usuario ya está registrado. Elegí otro nombre.'),
  ).toBeVisible();
  await press('Volver al login');
  expect(screen.getByText('Todo en un lugar.')).toBeVisible();
});

test('muestra errores de almacenamiento en el login y permite reintentar', async () => {
  await registerUser('Ana', 'Clave');
  render(<App />);
  fillCredentials('Ana', 'Clave');
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('Read failed'));
  await press('Iniciar sesión');
  expect(
    screen.getByText('No se pudieron leer las cuentas. Intentá nuevamente.'),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Crear tarea' })).toBeNull();
  await press('Iniciar sesión');
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
});

test('el registro no informa éxito cuando falla el guardado', async () => {
  render(<App />);
  await press('Ir al registro');
  fillCredentials('Ana', 'Clave');
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Write failed'));
  await press('Crear cuenta');
  expect(
    screen.getByText('No se pudo guardar la cuenta. Intentá nuevamente.'),
  ).toBeVisible();
  expect(screen.getByText('Tu espacio personal.')).toBeVisible();
  await press('Crear cuenta');
  expect(
    screen.getByText('Cuenta creada. Iniciá sesión con tu contraseña.'),
  ).toBeVisible();
});

test('bloquea envíos repetidos mientras se guarda la cuenta', async () => {
  const originalSetItem = AsyncStorage.setItem;
  let releaseWrite!: () => void;
  const pendingWrite = new Promise<void>(resolve => {
    releaseWrite = resolve;
  });
  jest
    .mocked(AsyncStorage.setItem)
    .mockImplementationOnce(async (key, value) => {
      await pendingWrite;
      await originalSetItem(key, value);
    });
  render(<App />);
  await press('Ir al registro');
  fillCredentials('Ana', 'Clave');
  await press('Crear cuenta');
  expect(
    screen.getByRole('button', { name: 'Creando cuenta…' }),
  ).toBeDisabled();
  fireEvent(screen.getByLabelText('Contraseña'), 'submitEditing');
  expect(AsyncStorage.setItem).toHaveBeenCalledTimes(1);
  await act(async () => releaseWrite());
  act(() => jest.runAllTimers());
  expect(
    screen.getByText('Cuenta creada. Iniciá sesión con tu contraseña.'),
  ).toBeVisible();
  expect(
    JSON.parse((await AsyncStorage.getItem(USERS_STORAGE_KEY))!),
  ).toHaveLength(1);
});
