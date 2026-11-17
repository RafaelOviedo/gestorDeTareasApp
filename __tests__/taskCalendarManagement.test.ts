import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import NativeTaskCalendar from '../specs/NativeTaskCalendar';
import * as permissions from '../src/services/devicePermissions';
import { getTasks, tasksStorageKey } from '../src/services/tasks';
import { useTasksStore } from '../src/stores/useTasksStore';

const owner = 'user:ana';
const store = () => useTasksStore.getState();
const draft = () => ({
  calendarId: 'default',
  startAt: new Date(Date.now() + 3600_000).toISOString(),
  durationMinutes: 60,
});

beforeEach(async () => {
  store().setOwner(null);
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest
    .spyOn(permissions, 'requestResourcePermission')
    .mockResolvedValue('granted');
  jest
    .spyOn(permissions, 'checkResourcePermission')
    .mockResolvedValue('granted');
  store().setOwner(owner);
  await store().addTask({ title: 'Exposición', reminderSeconds: 300 });
  await store().createCalendarEvent(store().tasks[0].id, draft());
  jest.clearAllMocks();
});
afterEach(() => {
  store().setOwner(null);
  jest.restoreAllMocks();
});

test('elimina el evento conservando tarea, recordatorio y demás datos y permite crear otro', async () => {
  const task = store().tasks[0];
  await store().deleteCalendarEvent(task.id);
  expect(NativeTaskCalendar!.deleteEvent).toHaveBeenCalledWith(
    task.calendarEvent!.eventId,
  );
  expect(store().tasks[0]).toEqual({
    ...task,
    calendarEvent: null,
    calendarRevision: 1,
  });
  expect(await getTasks(owner)).toEqual(store().tasks);
  expect(notifee.cancelNotification).not.toHaveBeenCalled();
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  await store().createCalendarEvent(task.id, draft());
  expect(NativeTaskCalendar!.createEvent).toHaveBeenCalledWith(
    JSON.stringify([owner, task.id, 1]),
    'default',
    task.title,
    expect.any(Number),
    expect.any(Number),
    expect.any(String),
    '',
  );
  expect(store().tasks[0].calendarEvent).not.toBeNull();
});

test('detecta una eliminación externa, persiste el vínculo vacío y no pide permisos automáticamente', async () => {
  const task = store().tasks[0];
  jest.mocked(NativeTaskCalendar!.getEvent).mockResolvedValueOnce(null);
  await store().refreshCalendarEvent(task.id);
  expect(store().tasks[0]).toEqual({
    ...task,
    calendarEvent: null,
    calendarRevision: 1,
  });
  expect(permissions.requestResourcePermission).not.toHaveBeenCalled();
  expect(NativeTaskCalendar!.deleteEvent).not.toHaveBeenCalled();
  store().setOwner(null);
  store().setOwner(owner);
  await store().loadTasks();
  expect(store().tasks[0].calendarEvent).toBeNull();
});

test('actualiza las fechas y el calendario desde el evento existente', async () => {
  const task = store().tasks[0];
  const startDate = Date.now() + 86400_000;
  jest
    .mocked(NativeTaskCalendar!.getEvent)
    .mockResolvedValueOnce({
      eventId: task.calendarEvent!.eventId,
      calendarId: 'personal',
      calendarName: 'Personal',
      startDate,
      endDate: startDate + 7200_000,
    });
  await store().refreshCalendarEvent(task.id, true);
  expect(permissions.requestResourcePermission).toHaveBeenCalledWith(
    'calendar',
  );
  expect(store().tasks[0].calendarEvent).toEqual({
    eventId: task.calendarEvent!.eventId,
    calendarId: 'personal',
    calendarName: 'Personal',
    startAt: new Date(startDate).toISOString(),
    endAt: new Date(startDate + 7200_000).toISOString(),
  });
  expect(store().tasks[0].title).toBe(task.title);
});

test('sin acceso completo conserva el vínculo sin consultar ni eliminar el evento', async () => {
  const task = store().tasks[0];
  jest
    .mocked(permissions.checkResourcePermission)
    .mockResolvedValueOnce('denied');
  await expect(store().refreshCalendarEvent(task.id)).rejects.toThrow(
    'acceso completo',
  );
  jest
    .mocked(permissions.requestResourcePermission)
    .mockResolvedValueOnce('blocked');
  await expect(store().deleteCalendarEvent(task.id)).rejects.toThrow(
    'acceso completo',
  );
  expect(NativeTaskCalendar!.getEvent).not.toHaveBeenCalled();
  expect(NativeTaskCalendar!.deleteEvent).not.toHaveBeenCalled();
  expect(await getTasks(owner)).toEqual([task]);
});

test('un error de consulta o eliminación nunca se interpreta como evento ausente', async () => {
  const task = store().tasks[0];
  jest
    .mocked(NativeTaskCalendar!.getEvent)
    .mockRejectedValueOnce(new Error('Calendar no disponible'));
  await expect(store().refreshCalendarEvent(task.id)).rejects.toThrow(
    'no disponible',
  );
  jest
    .mocked(NativeTaskCalendar!.deleteEvent)
    .mockRejectedValueOnce(new Error('No se pudo eliminar'));
  await expect(store().deleteCalendarEvent(task.id)).rejects.toThrow(
    'No se pudo eliminar',
  );
  expect(store().tasks).toEqual([task]);
  expect(await getTasks(owner)).toEqual([task]);
});

test('si falla el guardado después de eliminar, actualizar recupera el estado sin perder la tarea', async () => {
  const task = store().tasks[0];
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
  await expect(store().deleteCalendarEvent(task.id)).rejects.toThrow(
    'no se pudo actualizar la tarea',
  );
  expect(await getTasks(owner)).toEqual([task]);
  await store().refreshCalendarEvent(task.id);
  expect(store().tasks[0]).toEqual({
    ...task,
    calendarEvent: null,
    calendarRevision: 1,
  });
  expect(NativeTaskCalendar!.deleteEvent).toHaveBeenCalledTimes(1);
});

test('si falla guardar una eliminación externa conserva el vínculo y permite reintentar', async () => {
  const task = store().tasks[0];
  jest
    .mocked(NativeTaskCalendar!.getEvent)
    .mockResolvedValueOnce(null)
    .mockResolvedValueOnce(null);
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
  await expect(store().refreshCalendarEvent(task.id)).rejects.toThrow(
    'No se pudo guardar el estado',
  );
  expect(store().tasks).toEqual([task]);
  await store().refreshCalendarEvent(task.id);
  expect(store().tasks[0].calendarEvent).toBeNull();
});

test('verificar un evento sin cambios no escribe ni incrementa su revisión', async () => {
  const task = store().tasks[0];
  await store().refreshCalendarEvent(task.id);
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  expect(store().tasks).toEqual([task]);
});

test('bloquea tareas ajenas y una sesión cerrada mientras se solicita permiso', async () => {
  const task = store().tasks[0];
  store().setOwner('user:juan');
  await expect(store().deleteCalendarEvent(task.id)).rejects.toThrow(
    'No se encontró',
  );
  store().setOwner(owner);
  await store().loadTasks();
  let resolve!: (value: 'granted') => void;
  let started!: () => void;
  const ready = new Promise<void>(done => {
    started = done;
  });
  jest
    .mocked(permissions.requestResourcePermission)
    .mockImplementationOnce(() => {
      started();
      return new Promise(done => {
        resolve = done;
      });
    });
  const pending = store().deleteCalendarEvent(task.id);
  await ready;
  expect(await store().deleteCalendarEvent(task.id)).toBe(false);
  store().setOwner('user:juan');
  resolve('granted');
  expect(await pending).toBe(false);
  expect(NativeTaskCalendar!.deleteEvent).not.toHaveBeenCalled();
  expect(await getTasks(owner)).toEqual([task]);
});

test('rechaza una revisión corrupta sin sobrescribir tareas antiguas', async () => {
  const task = store().tasks[0];
  const raw = JSON.stringify([{ ...task, calendarRevision: -1 }]);
  await AsyncStorage.setItem(tasksStorageKey(owner), raw);
  await store().loadTasks();
  expect(store().loadError).toContain('formato inválido');
  expect(await AsyncStorage.getItem(tasksStorageKey(owner))).toBe(raw);
});
