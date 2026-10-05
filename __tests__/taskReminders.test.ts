import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee, { AuthorizationStatus } from '@notifee/react-native';
import {
  addTask,
  deleteTask,
  getTasks,
  setTaskCompleted,
} from '../src/services/tasks';

const owner = 'user:ana';
const draft = { title: 'Demostración', reminderSeconds: 10 };
const now = Date.parse('2026-10-03T15:00:00.000Z');
beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(Date, 'now').mockReturnValue(now);
});
afterEach(() => jest.restoreAllMocks());

test('10 segundos se cuentan después de responder al permiso, y el id nativo persiste', async () => {
  const settings = await notifee.getNotificationSettings();
  jest.mocked(notifee.requestPermission).mockImplementationOnce(async () => {
    jest.mocked(Date.now).mockReturnValue(now + 30000);
    return settings;
  });
  const task = await addTask(owner, draft);
  expect(Date.parse(task.reminderAt!)).toBe(now + 40000);
  expect(task.notificationId).toBeTruthy();
  expect(await getTasks(owner)).toEqual([task]);
  expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
    expect.objectContaining({ id: task.notificationId }),
    expect.objectContaining({ timestamp: now + 40000 }),
  );
});

test('sin recordatorio no pide permisos ni programa avisos', async () => {
  await addTask(owner, { ...draft, reminderSeconds: 0 });
  expect(notifee.requestPermission).not.toHaveBeenCalled();
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
});

test('si se deniega el permiso no crea una tarea incompleta', async () => {
  const settings = await notifee.getNotificationSettings();
  jest
    .mocked(notifee.requestPermission)
    .mockResolvedValueOnce({
      ...settings,
      authorizationStatus: AuthorizationStatus.DENIED,
    });
  await expect(addTask(owner, draft)).rejects.toThrow(
    'Permití las notificaciones',
  );
  expect(await getTasks(owner)).toEqual([]);
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
});

test('si falla programar conserva los datos existentes y limpia el posible disparador parcial', async () => {
  const first = await addTask(owner, { ...draft, reminderSeconds: 0 });
  jest
    .mocked(notifee.createTriggerNotification)
    .mockRejectedValueOnce(new Error('Native error'));
  await expect(addTask(owner, draft)).rejects.toThrow('No se pudo programar');
  expect(await getTasks(owner)).toEqual([first]);
  expect(notifee.cancelNotification).toHaveBeenCalledTimes(1);
});

test('si falla guardar cancela el aviso recién creado', async () => {
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk error'));
  await expect(addTask(owner, draft)).rejects.toThrow('No se pudo guardar');
  const notification = jest.mocked(notifee.createTriggerNotification).mock
    .calls[0][0];
  expect(notifee.cancelNotification).toHaveBeenCalledWith(notification.id);
  expect(await getTasks(owner)).toEqual([]);
});

test('completar cancela; reabrir antes de la fecha programa de nuevo con el mismo id', async () => {
  const task = await addTask(owner, draft);
  const completed = await setTaskCompleted(owner, task.id, true);
  expect(completed.notificationId).toBeNull();
  expect(notifee.cancelNotification).toHaveBeenCalledWith(task.notificationId);
  const reopened = await setTaskCompleted(owner, task.id, false);
  expect(reopened.notificationId).toBe(task.notificationId);
  expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(2);
  expect(await getTasks(owner)).toEqual([reopened]);
});

test('reabrir una tarea vencida no genera un aviso tardío ni vuelve a pedir permisos', async () => {
  const task = await addTask(owner, draft);
  await setTaskCompleted(owner, task.id, true);
  jest.clearAllMocks();
  jest.mocked(Date.now).mockReturnValue(now + 11000);
  const reopened = await setTaskCompleted(owner, task.id, false);
  expect(reopened.completed).toBe(false);
  expect(reopened.notificationId).toBeNull();
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  expect(notifee.requestPermission).not.toHaveBeenCalled();
});

test('si vence mientras se responde al permiso queda pendiente sin un disparador pasado', async () => {
  const task = await addTask(owner, draft);
  await setTaskCompleted(owner, task.id, true);
  const settings = await notifee.getNotificationSettings();
  jest.mocked(notifee.requestPermission).mockImplementationOnce(async () => {
    jest.mocked(Date.now).mockReturnValue(now + 11000);
    return settings;
  });
  const reopened = await setTaskCompleted(owner, task.id, false);
  expect(reopened.completed).toBe(false);
  expect(reopened.notificationId).toBeNull();
  expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1);
});

test('eliminar cancela solo el aviso de esa tarea y preserva el de otro usuario', async () => {
  const task = await addTask(owner, draft);
  const other = await addTask('user:juan', draft);
  await deleteTask(owner, task.id);
  expect(notifee.cancelNotification).toHaveBeenCalledWith(task.notificationId);
  expect(notifee.cancelNotification).not.toHaveBeenCalledWith(
    other.notificationId,
  );
  expect(await getTasks(owner)).toEqual([]);
  expect(await getTasks('user:juan')).toEqual([other]);
});

test.each(['completar', 'eliminar'])(
  'si falla cancelar no permite %s la tarea',
  async operation => {
    const task = await addTask(owner, draft);
    jest
      .mocked(notifee.cancelNotification)
      .mockRejectedValueOnce(new Error('Native error'));
    await expect(
      operation === 'completar'
        ? setTaskCompleted(owner, task.id, true)
        : deleteTask(owner, task.id),
    ).rejects.toThrow('No se pudo cancelar');
    expect(await getTasks(owner)).toEqual([task]);
  },
);

test.each(['completar', 'eliminar'])(
  'si falla persistir al %s restaura el recordatorio cancelado',
  async operation => {
    const task = await addTask(owner, draft);
    jest
      .mocked(AsyncStorage.setItem)
      .mockRejectedValueOnce(new Error('Disk error'));
    await expect(
      operation === 'completar'
        ? setTaskCompleted(owner, task.id, true)
        : deleteTask(owner, task.id),
    ).rejects.toThrow('Intentá nuevamente');
    expect(notifee.cancelNotification).toHaveBeenCalledWith(
      task.notificationId,
    );
    expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(2);
    expect(await getTasks(owner)).toEqual([task]);
  },
);

test('si falla guardar al reabrir retira el nuevo aviso y conserva la tarea completada', async () => {
  const task = await addTask(owner, draft);
  const completed = await setTaskCompleted(owner, task.id, true);
  jest.clearAllMocks();
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk error'));
  await expect(setTaskCompleted(owner, task.id, false)).rejects.toThrow(
    'No se pudo actualizar',
  );
  expect(notifee.cancelNotification).toHaveBeenCalledWith(task.notificationId);
  expect(await getTasks(owner)).toEqual([completed]);
});

test('informa si también falla restaurar el recordatorio después de un error de escritura', async () => {
  const task = await addTask(owner, draft);
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk error'));
  jest
    .mocked(notifee.createTriggerNotification)
    .mockRejectedValueOnce(new Error('Native error'));
  await expect(setTaskCompleted(owner, task.id, true)).rejects.toThrow(
    'no se pudo restaurar el recordatorio',
  );
  expect(await getTasks(owner)).toEqual([task]);
});
