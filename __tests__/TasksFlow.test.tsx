import notifee, { AuthorizationStatus } from '@notifee/react-native';
import { requestMultiple } from 'react-native-permissions';
import { launchCamera, launchImageLibrary } from 'react-native-image-picker';
import { FileSystem as mockFiles } from 'react-native-file-access/jest/mock';
import { Alert } from 'react-native';
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import App from '../App';
import { registerUser } from '../src/services/auth';
import { addTask, getTasks, tasksStorageKey } from '../src/services/tasks';
import { useTasksStore } from '../src/stores/useTasksStore';

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

test('abre el detalle por id, refleja cambios del store y vuelve a Home sin pedir permisos', async () => {
  await renderApp();
  await login();
  await createTask();
  await press('Ver detalle: Repasar');
  expect(screen.getByText('Fecha de creación')).toBeVisible();
  expect(screen.getByText('Repasar')).toBeVisible();
  const task = useTasksStore.getState().tasks[0];
  await act(async () => { await useTasksStore.getState().updateTask(task.id, { completed: true }); });
  expect(screen.getByText('Completada')).toBeVisible();
  await press('Ver permisos del dispositivo');
  expect(screen.getByText('Cámara')).toBeVisible();
  expect(requestMultiple).not.toHaveBeenCalled();
  await press('Volver a mis tareas');
  expect(screen.getByText('0 pendientes · 1 completada')).toBeVisible();
});

test('el detalle maneja una tarea eliminada sin mostrar datos viejos', async () => {
  await renderApp();
  await login();
  await createTask();
  await press('Ver detalle: Repasar');
  const task = useTasksStore.getState().tasks[0];
  await act(async () => { await useTasksStore.getState().deleteTask(task.id); });
  expect(screen.getByText('Tarea no encontrada')).toBeVisible();
  await press('Volver a mis tareas');
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
});

test('adjunta una foto desde el detalle, la conserva al reiniciar y permite quitarla', async () => {
  const app = await renderApp();
  await login();
  await createTask();
  await press('Ver detalle: Repasar');
  mockFiles.filesystem.set('/cache/photo.jpg', 'photo');
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ assets: [{ uri: 'file:///cache/photo.jpg', type: 'image/jpeg' }] });
  await press('Elegir de galería');
  expect(screen.getByLabelText('Foto de la tarea: Repasar')).toBeVisible();
  await press('Volver a mis tareas');
  expect(screen.getByLabelText('Foto de la tarea: Repasar')).toBeVisible();
  app.unmount();
  await renderApp();
  expect(screen.getByLabelText('Foto de la tarea: Repasar')).toBeVisible();
  await press('Ver detalle: Repasar');
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ didCancel: true });
  await press('Elegir de galería');
  expect(screen.getByLabelText('Foto de la tarea: Repasar')).toBeVisible();
  const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  await press('Quitar foto');
  expect(screen.getByLabelText('Foto de la tarea: Repasar')).toBeVisible();
  await act(async () => { alert.mock.calls[0][2]?.find(button => button.text === 'Quitar')?.onPress?.(); });
  expect(screen.queryByLabelText('Foto de la tarea: Repasar')).toBeNull();
  expect((await getTasks('user:ana'))[0].imagePath).toBeNull();
});

test('informa que la cámara no está disponible y permite seguir usando el detalle', async () => {
  await renderApp();
  await login();
  await createTask();
  await press('Ver detalle: Repasar');
  jest.mocked(launchCamera).mockResolvedValueOnce({ errorCode: 'camera_unavailable' });
  await press('Tomar foto');
  expect(screen.getByText('La cámara no está disponible en este dispositivo.')).toBeVisible();
  expect(screen.getByRole('button', { name: 'Elegir de galería' })).toBeEnabled();
});

test('crea, vuelve a listar y conserva una tarea al remontar la app; otro usuario no la ve', async () => {
  const app = await renderApp();
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
  await renderApp();
  expect(screen.getByText('Repasar')).toBeVisible();
  await press('Cerrar sesión');
  expect(useTasksStore.getState().userId).toBeNull();
  expect(useTasksStore.getState().tasks).toEqual([]);
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

test('Home se actualiza por la suscripción al store sin navegar ni recargar la lista', async () => {
  await renderApp();
  await login();
  await act(async () => {
    await useTasksStore
      .getState()
      .addTask({ title: 'Desde el store', reminderSeconds: 0 });
  });
  expect(screen.getByText('Desde el store')).toBeVisible();
  const task = useTasksStore.getState().tasks[0];
  await act(async () => {
    await useTasksStore.getState().updateTask(task.id, { completed: true });
  });
  expect(screen.getByText('Completada')).toBeVisible();
  await act(async () => {
    await useTasksStore.getState().deleteTask(task.id);
  });
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
});

test('cancelar no guarda y un título vacío muestra validación', async () => {
  await renderApp();
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
  const app = await renderApp();
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
  await renderApp();
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
});

test('si falla el guardado mantiene el formulario y permite reintentar', async () => {
  await renderApp();
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
  await renderApp();
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
  await renderApp();
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
  await renderApp();
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
  const app = await renderApp();
  await login();
  await createTask();
  expect(screen.getByText('1 pendiente · 0 completadas')).toBeVisible();
  await press('Completar tarea: Repasar');
  expect(screen.getByText('Completada')).toBeVisible();
  expect(screen.getByText('0 pendientes · 1 completada')).toBeVisible();
  app.unmount();
  await renderApp();
  expect(screen.getByText('Completada')).toBeVisible();
  await press('Marcar como pendiente: Repasar');
  expect(screen.getByText('Pendiente')).toBeVisible();
  expect((await getTasks('user:ana'))[0].completed).toBe(false);
  await press('Cerrar sesión');
  await login('Juan', 'Otra');
  expect(screen.getByText('Todavía no hay tareas')).toBeVisible();
});

test('si falla completar conserva el estado visible y permite reintentar', async () => {
  await renderApp();
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
  await renderApp();
  await login();
  await press('Crear tarea');
  fireEvent.changeText(screen.getByLabelText('Título de la tarea'), 'Demo');
  fireEvent.press(screen.getByRole('radio', { name: '10 segundos' }));
  const settings = await notifee.getNotificationSettings();
  jest.mocked(notifee.requestPermission).mockResolvedValueOnce({
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
