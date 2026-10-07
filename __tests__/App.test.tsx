import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import {
  registerUser,
  saveSession,
  SESSION_STORAGE_KEY,
  USERS_STORAGE_KEY,
} from '../src/services/auth';

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
});

async function renderApp() {
  const app = render(<App />);
  await waitFor(() => {
    expect(screen.queryByLabelText('Recuperando sesión')).toBeNull();
  });
  return app;
}

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
  await renderApp();
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
  await renderApp();
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

test('al remontar la app recupera la sesión sin volver a pedir credenciales', async () => {
  await registerUser('Ana', 'Clave');
  const app = await renderApp();
  fillCredentials('Ana', 'Clave');
  await press('Iniciar sesión');
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
  app.unmount();
  await renderApp();
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
  expect(screen.queryByText('Todo en un lugar.')).toBeNull();
});

test('muestra duplicados en Registro y permite volver sin iniciar sesión', async () => {
  await registerUser('Ana', 'Clave');
  await renderApp();
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
  await renderApp();
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
  await renderApp();
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
  await renderApp();
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

test('espera a recuperar la sesión antes de mostrar Login o Home', async () => {
  const user = await registerUser('Ana', 'Clave');
  await saveSession(user.id);
  const originalGetItem = jest
    .mocked(AsyncStorage.getItem)
    .getMockImplementation()!;
  let releaseRead!: () => void;
  const pendingRead = new Promise<void>(resolve => {
    releaseRead = resolve;
  });
  jest.mocked(AsyncStorage.getItem).mockImplementationOnce(async key => {
    await pendingRead;
    return originalGetItem(key);
  });
  render(<App />);
  expect(screen.getByLabelText('Recuperando sesión')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Crear tarea' })).toBeNull();
  await act(async () => {
    releaseRead();
  });
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
});

test('cerrar sesión se conserva al remontar la app y permite entrar con otra cuenta', async () => {
  const ana = await registerUser('Ana', 'Clave');
  await registerUser('Juan', 'Otra');
  await saveSession(ana.id);
  const app = await renderApp();
  await press('Cerrar sesión');
  expect(await AsyncStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  app.unmount();
  await renderApp();
  expect(screen.getByText('Todo en un lugar.')).toBeVisible();
  fillCredentials('Juan', 'Otra');
  await press('Iniciar sesión');
  expect(screen.getByText('Hola, Juan.')).toBeVisible();
  expect(await AsyncStorage.getItem(SESSION_STORAGE_KEY)).toBe('user:juan');
});

test('si falla recuperar la sesión ofrece reintentar sin mostrar pantallas privadas', async () => {
  const user = await registerUser('Ana', 'Clave');
  await saveSession(user.id);
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('Read failed'));
  await renderApp();
  expect(
    screen.getByText('No se pudo recuperar la sesión. Intentá nuevamente.'),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Crear tarea' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Iniciar sesión' })).toBeNull();
  await press('Reintentar sesión');
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
});

test('si falla guardar la sesión mantiene Login y permite reintentar', async () => {
  await registerUser('Ana', 'Clave');
  await renderApp();
  fillCredentials('Ana', 'Clave');
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk error'));
  await press('Iniciar sesión');
  expect(
    screen.getByText('No se pudo guardar la sesión. Intentá nuevamente.'),
  ).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Crear tarea' })).toBeNull();
  expect(await AsyncStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
  await press('Iniciar sesión');
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
});

test('si falla borrar la sesión mantiene Home y permite reintentar el cierre', async () => {
  const user = await registerUser('Ana', 'Clave');
  await saveSession(user.id);
  await renderApp();
  jest
    .mocked(AsyncStorage.removeItem)
    .mockRejectedValueOnce(new Error('Disk error'));
  await press('Cerrar sesión');
  expect(screen.getByText('Hola, Ana.')).toBeVisible();
  expect(
    screen.getByText('No se pudo cerrar la sesión. Intentá nuevamente.'),
  ).toBeVisible();
  expect(await AsyncStorage.getItem(SESSION_STORAGE_KEY)).toBe(user.id);
  await press('Cerrar sesión');
  expect(screen.getByText('Todo en un lugar.')).toBeVisible();
  expect(await AsyncStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
});

test('una cuenta eliminada no obtiene acceso al restaurar su antigua sesión', async () => {
  await saveSession('user:eliminado');
  await renderApp();
  expect(screen.getByText('Todo en un lugar.')).toBeVisible();
  expect(screen.queryByRole('button', { name: 'Crear tarea' })).toBeNull();
  expect(await AsyncStorage.getItem(SESSION_STORAGE_KEY)).toBeNull();
});
