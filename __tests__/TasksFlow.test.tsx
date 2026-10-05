import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { registerUser } from '../src/services/auth';
import { addTask, getTasks, tasksStorageKey } from '../src/services/tasks';

beforeEach(async () => {
  jest.useFakeTimers();
  await AsyncStorage.clear();
  jest.clearAllMocks();
  await registerUser('Ana', 'Clave');
  await registerUser('Juan', 'Otra');
});
afterEach(() => {
  act(() => jest.runOnlyPendingTimers());
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function press(label: string) {
  await act(async () => {
    fireEvent.press(screen.getByRole('button', { name: label }));
    jest.runAllTimers();
  });
}

async function login(username = 'Ana', password = 'Clave') {
  fireEvent.changeText(screen.getByLabelText('Usuario'), username);
  fireEvent.changeText(screen.getByLabelText('Contraseña'), password);
  await press('Iniciar sesión');
}

async function createTask(title = 'Repasar') {
  await press('Crear tarea');
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), title);
  await press('Guardar tarea');
}

test('crea, vuelve a listar y conserva una tarea al remontar la app; otro usuario no la ve', async () => {
  const app = render(<App />);
  await login();
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
  await press('Crear tarea');
  fireEvent.changeText(
    screen.getByLabelText('Título de la tarea'),
    '  Repasar  ',
  );
  fireEvent.press(screen.getByRole('radio', { name: '1 minuto' }));
  await press('Guardar tarea');
  expect(screen.getByText('Repasar')).toBeVisible();
  expect(
    screen.getByText('Notificación solicitada para esa fecha'),
  ).toBeVisible();
  app.unmount();
  render(<App />);
  await login();
  expect(screen.getByText('Repasar')).toBeVisible();
  await press('Cerrar sesión');
  await login('Juan', 'Otra');
  expect(
    screen.queryByText('Repasar', { includeHiddenElements: true }),
  ).toBeNull();
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
  await createTask('Comprar');
  await press('Cerrar sesión');
  await login();
  expect(screen.getByText('Repasar')).toBeVisible();
  expect(
    screen.queryByText('Comprar', { includeHiddenElements: true }),
  ).toBeNull();
});

test('cancelar no guarda y un título vacío muestra validación', async () => {
  render(<App />);
  await login();
  await press('Crear tarea');
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), '   ');
  await press('Guardar tarea');
  expect(screen.getByText('Ingresá un título para la tarea.')).toBeVisible();
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), 'Borrador');
  await press('Cancelar');
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
  expect(await getTasks('user:ana')).toEqual([]);
});

test('elimina solo después de confirmar y la eliminación persiste', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  const app = render(<App />);
  await login();
  await createTask();
  await press('Eliminar tarea: Repasar');
  expect(alert).toHaveBeenCalledWith(
    'Eliminar tarea',
    expect.stringContaining('Repasar'),
    expect.any(Array),
  );
  // Antes de confirmar (o al cancelar) no se toca el almacenamiento.
  expect(await getTasks('user:ana')).toHaveLength(1);
  const buttons = alert.mock.calls[0][2];
  await act(async () => {
    buttons?.find(button => button.text === 'Eliminar')?.onPress?.();
  });
  expect(screen.queryByText('Repasar')).toBeNull();
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
  app.unmount();
  render(<App />);
  await login();
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
});

test('si falla el guardado mantiene el formulario y permite reintentar', async () => {
  render(<App />);
  await login();
  await press('Crear tarea');
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), 'Repasar');
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Write failed'));
  await press('Guardar tarea');
  expect(
    screen.getByText('No se pudo guardar la tarea. Intentá nuevamente.'),
  ).toBeVisible();
  expect(screen.getByLabelText('Título de la tarea')).toHaveDisplayValue(
    'Repasar',
  );
  expect(await getTasks('user:ana')).toEqual([]);
  await press('Guardar tarea');
  expect(screen.getByText('Repasar')).toBeVisible();
  expect(await getTasks('user:ana')).toHaveLength(1);
});

test('si falla eliminar la tarea permanece visible y guardada', async () => {
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  render(<App />);
  await login();
  await createTask();
  await press('Eliminar tarea: Repasar');
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Write failed'));
  await act(async () => {
    alert.mock.calls[0][2]
      ?.find(button => button.text === 'Eliminar')
      ?.onPress?.();
  });
  expect(
    screen.getByText('No se pudo eliminar la tarea. Intentá nuevamente.'),
  ).toBeVisible();
  expect(screen.getByText('Repasar')).toBeVisible();
  expect(await getTasks('user:ana')).toHaveLength(1);
});

test('distingue un error de carga de una lista vacía y permite reintentar', async () => {
  await addTask('user:ana', { title: 'Repasar', reminderSeconds: 0 });
  render(<App />);
  const originalGetItem = jest
    .mocked(AsyncStorage.getItem)
    .getMockImplementation()!;
  jest
    .mocked(AsyncStorage.getItem)
    .mockImplementationOnce(async key => originalGetItem(key))
    .mockRejectedValueOnce(new Error('Read failed'));
  await login();
  expect(
    screen.getByText('No se pudieron cargar las tareas. Intentá nuevamente.'),
  ).toBeVisible();
  expect(screen.queryByText('Todavía no hay tareas')).toBeNull();
  await press('Reintentar carga');
  expect(screen.getByText('Repasar')).toBeVisible();
});

test('un doble toque durante el guardado crea una sola tarea', async () => {
  render(<App />);
  await login();
  await press('Crear tarea');
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), 'Repasar');
  const originalSetItem = jest
    .mocked(AsyncStorage.setItem)
    .getMockImplementation()!;
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
  await press('Guardar tarea');
  expect(screen.getByRole('button', { name: 'Guardando…' })).toBeDisabled();
  await press('Guardando…');
  await act(async () => {
    releaseWrite();
  });
  expect(screen.getByText('Repasar')).toBeVisible();
  expect(
    JSON.parse((await AsyncStorage.getItem(tasksStorageKey('user:ana')))!),
  ).toHaveLength(1);
});

test('completa, conserva el estado al remontar y permite volver a pendiente', async () => {
  const app = render(<App />);
  await login();
  await createTask();
  expect(screen.getByText('1 pendiente · 0 completadas')).toBeVisible();
  await press('Completar tarea: Repasar');
  expect(screen.getByText('Completada')).toBeVisible();
  expect(screen.getByText('0 pendientes · 1 completada')).toBeVisible();
  app.unmount();
  render(<App />);
  await login();
  expect(screen.getByText('Completada')).toBeVisible();
  await press('Marcar como pendiente: Repasar');
  expect(screen.getByText('Pendiente')).toBeVisible();
  expect((await getTasks('user:ana'))[0].completed).toBe(false);
  await press('Cerrar sesión');
  await login('Juan', 'Otra');
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
});

test('si falla completar conserva el estado visible y permite reintentar', async () => {
  render(<App />);
  await login();
  await createTask();
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk error'));
  await press('Completar tarea: Repasar');
  expect(
    screen.getByText('No se pudo actualizar la tarea. Intentá nuevamente.'),
  ).toBeVisible();
  expect(screen.getByText('Pendiente')).toBeVisible();
  expect((await getTasks('user:ana'))[0].completed).toBe(false);
  await press('Completar tarea: Repasar');
  expect(screen.getByText('Completada')).toBeVisible();
});

test('ofrece 10 segundos y permite guardar sin recordatorio después de rechazar el permiso', async () => {
  render(<App />);
  await login();
  await press('Crear tarea');
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), 'Demo');
  fireEvent.press(screen.getByRole('radio', { name: '10 segundos' }));
  const settings = await notifee.getNotificationSettings();
  jest
    .mocked(notifee.requestPermission)
    .mockResolvedValueOnce({
      ...settings,
      authorizationStatus: AuthorizationStatus.DENIED,
    });
  await press('Guardar tarea');
  expect(
    screen.getByRole('button', { name: 'Abrir ajustes de notificaciones' }),
  ).toBeVisible();
  expect(screen.getByLabelText('Título de la tarea')).toHaveDisplayValue(
    'Demo',
  );
  expect(await getTasks('user:ana')).toEqual([]);
  fireEvent.press(screen.getByRole('radio', { name: 'Sin recordatorio' }));
  await press('Guardar tarea');
  expect(screen.getByText('Demo')).toBeVisible();
  expect((await getTasks('user:ana'))[0].notificationId).toBeNull();
});
