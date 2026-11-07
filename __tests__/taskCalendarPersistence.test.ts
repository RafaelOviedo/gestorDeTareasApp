import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import NativeTaskCalendar from '../specs/NativeTaskCalendar';
import * as calendarService from '../src/services/taskCalendar';
import * as permissions from '../src/services/devicePermissions';
import {
  addTask,
  createTaskCalendarEvent,
  deleteTask,
  getTasks,
  setTaskCompleted,
  tasksStorageKey,
} from '../src/services/tasks';
import { useTasksStore } from '../src/stores/useTasksStore';
import type { TaskCalendarEvent } from '../src/types/task';

const owner = 'user:ana';
const store = () => useTasksStore.getState();
const event: TaskCalendarEvent = {
  eventId: 'event-1',
  calendarId: 'default',
  calendarName: 'Personal',
  startAt: '2027-01-01T12:00:00.000Z',
  endAt: '2027-01-01T13:00:00.000Z',
};
const draft = {
  calendarId: 'default',
  startAt: event.startAt,
  durationMinutes: 60,
};

beforeEach(async () => {
  store().setOwner(null);
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest
    .spyOn(permissions, 'checkResourcePermission')
    .mockResolvedValue('granted');
});
afterEach(() => {
  store().setOwner(null);
  jest.restoreAllMocks();
});

test('guarda y recupera el vínculo al reiniciar sin modificar notificaciones', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 300 });
  store().setOwner(owner);
  await store().loadTasks();
  jest.clearAllMocks();
  expect(await store().createCalendarEvent(task.id, draft)).toBe(true);
  const saved = store().tasks[0];
  expect(saved.calendarEvent?.eventId).toBe('event-1');
  expect(saved.notificationId).toBe(task.notificationId);
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  expect(notifee.cancelNotification).not.toHaveBeenCalled();
  store().setOwner(null);
  store().setOwner(owner);
  await store().loadTasks();
  expect(store().tasks).toEqual([saved]);
  await store().createCalendarEvent(task.id, draft);
  expect(NativeTaskCalendar!.createEvent).toHaveBeenCalledTimes(1);
});

test('si falla AsyncStorage, conserva la tarea y recupera el resultado previo al reintentar', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  store().setOwner(owner);
  await store().loadTasks();
  // Simula la devolución del mismo evento que conserva el registro nativo.
  jest
    .mocked(NativeTaskCalendar!.createEvent)
    .mockResolvedValueOnce({
      eventId: event.eventId,
      calendarId: event.calendarId,
      calendarName: event.calendarName,
      startDate: Date.parse(event.startAt),
      endDate: Date.parse(event.endAt),
    })
    .mockResolvedValueOnce({
      eventId: event.eventId,
      calendarId: event.calendarId,
      calendarName: event.calendarName,
      startDate: Date.parse(event.startAt),
      endDate: Date.parse(event.endAt),
    });
  jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
  await expect(store().createCalendarEvent(task.id, draft)).rejects.toThrow(
    'recuperar el vínculo',
  );
  expect(store().tasks).toEqual([task]);
  expect(await getTasks(owner)).toEqual([task]);
  await store().createCalendarEvent(task.id, { ...draft, durationMinutes: 30 });
  expect(store().tasks[0].calendarEvent).toEqual(event);
  const calls = jest.mocked(NativeTaskCalendar!.createEvent).mock.calls;
  expect(calls[0][0]).toBe(calls[1][0]);
});

test('lee tareas antiguas y rechaza vínculos corruptos sin sobrescribir datos', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  const old = { ...task };
  delete old.calendarEvent;
  await AsyncStorage.setItem(tasksStorageKey(owner), JSON.stringify([old]));
  expect(await getTasks(owner)).toEqual([old]);
  const corrupt = JSON.stringify([
    { ...task, calendarEvent: { ...event, endAt: 'invalid' } },
  ]);
  await AsyncStorage.setItem(tasksStorageKey(owner), corrupt);
  await expect(createTaskCalendarEvent(owner, task.id, draft)).rejects.toThrow(
    'formato inválido',
  );
  expect(await AsyncStorage.getItem(tasksStorageKey(owner))).toBe(corrupt);
  expect(NativeTaskCalendar!.createEvent).not.toHaveBeenCalled();
});

test('no crea eventos para tareas ajenas y bloquea acciones simultáneas', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  store().setOwner('user:juan');
  await expect(store().createCalendarEvent(task.id, draft)).rejects.toThrow(
    'No se encontró',
  );
  expect(NativeTaskCalendar!.createEvent).not.toHaveBeenCalled();
  store().setOwner(owner);
  await store().loadTasks();
  const pending = store().createCalendarEvent(task.id, draft);
  expect(await store().createCalendarEvent(task.id, draft)).toBe(false);
  expect(await pending).toBe(true);
  expect(NativeTaskCalendar!.createEvent).toHaveBeenCalledTimes(1);
});

test('no crea si se cierra la sesión durante la consulta del permiso', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  store().setOwner(owner);
  await store().loadTasks();
  let resolve!: (value: 'granted') => void;
  let started!: () => void;
  const ready = new Promise<void>(done => {
    started = done;
  });
  jest
    .mocked(permissions.checkResourcePermission)
    .mockImplementationOnce(() => {
      started();
      return new Promise(done => {
        resolve = done;
      });
    });
  const pending = store().createCalendarEvent(task.id, draft);
  await ready;
  store().setOwner('user:juan');
  resolve('granted');
  expect(await pending).toBe(false);
  expect(NativeTaskCalendar!.createEvent).not.toHaveBeenCalled();
  expect(await getTasks(owner)).toEqual([task]);
});

test('una respuesta nativa tardía guarda solo para su dueño y no contamina otra sesión', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  store().setOwner(owner);
  await store().loadTasks();
  let resolve!: (value: TaskCalendarEvent) => void;
  let started!: () => void;
  const ready = new Promise<void>(done => {
    started = done;
  });
  jest
    .spyOn(calendarService, 'createDeviceCalendarEvent')
    .mockImplementationOnce(() => {
      started();
      return new Promise(done => {
        resolve = done;
      });
    });
  const pending = store().createCalendarEvent(task.id, draft);
  await ready;
  store().setOwner('user:juan');
  resolve(event);
  expect(await pending).toBe(false);
  expect(store().tasks).toEqual([]);
  expect((await getTasks(owner))[0].calendarEvent).toEqual(event);
  expect(await getTasks('user:juan')).toEqual([]);
});

test('completar y eliminar la tarea no vuelve a escribir en el calendario', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  await createTaskCalendarEvent(owner, task.id, draft);
  jest.clearAllMocks();
  const completed = await setTaskCompleted(owner, task.id, true);
  expect(completed.calendarEvent?.eventId).toBe('event-1');
  await deleteTask(owner, task.id);
  expect(await getTasks(owner)).toEqual([]);
  expect(NativeTaskCalendar!.createEvent).not.toHaveBeenCalled();
});
