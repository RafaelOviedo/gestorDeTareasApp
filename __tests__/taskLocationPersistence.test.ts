import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import {
  addTask,
  getTasks,
  setTaskLocation,
  tasksStorageKey,
} from '../src/services/tasks';
import * as locationService from '../src/services/taskLocation';
import { useTasksStore } from '../src/stores/useTasksStore';
import type { TaskLocation } from '../src/types/task';

const owner = 'user:ana';
const location: TaskLocation = {
  latitude: -34.603722,
  longitude: -58.381592,
  accuracy: 12,
  capturedAt: '2026-11-07T15:00:00Z',
};
const store = () => useTasksStore.getState();

beforeEach(async () => {
  store().setOwner(null);
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(locationService, 'getTaskLocation').mockResolvedValue(location);
});
afterEach(() => {
  store().setOwner(null);
  jest.restoreAllMocks();
});

test('guarda, actualiza y quita ubicación sin afectar los otros datos ni recordatorios', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 300 });
  jest.clearAllMocks();
  const saved = await setTaskLocation(owner, task.id, location);
  expect(await getTasks(owner)).toEqual([{ ...task, location }]);
  expect(saved.notificationId).toBe(task.notificationId);
  await setTaskLocation(owner, task.id, { ...location, latitude: 0 });
  expect((await getTasks(owner))[0].location?.latitude).toBe(0);
  await setTaskLocation(owner, task.id, null);
  expect(await getTasks(owner)).toEqual([task]);
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  expect(notifee.cancelNotification).not.toHaveBeenCalled();
});

test('si falla actualizar o quitar, conserva el lugar anterior y permite reintentar', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  const saved = await setTaskLocation(owner, task.id, location);
  for (const next of [{ ...location, latitude: 0 }, null]) {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
    await expect(setTaskLocation(owner, task.id, next)).rejects.toThrow(
      'No se pudo guardar la ubicación',
    );
    expect(await getTasks(owner)).toEqual([saved]);
  }
  await setTaskLocation(owner, task.id, null);
  expect((await getTasks(owner))[0].location).toBeNull();
});

test('lee tareas antiguas sin ubicación, pero conserva datos corruptos sin sobrescribirlos', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  const old = { ...task };
  delete old.location;
  await AsyncStorage.setItem(tasksStorageKey(owner), JSON.stringify([old]));
  expect(await getTasks(owner)).toEqual([old]);
  const invalid = JSON.stringify([
    { ...task, location: { ...location, latitude: 200 } },
  ]);
  await AsyncStorage.setItem(tasksStorageKey(owner), invalid);
  await expect(setTaskLocation(owner, task.id, location)).rejects.toThrow(
    'formato inválido',
  );
  expect(await AsyncStorage.getItem(tasksStorageKey(owner))).toBe(invalid);
});

test('no permite asociar ubicaciones inválidas o a tareas de otro usuario', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  await expect(setTaskLocation('user:juan', task.id, location)).rejects.toThrow(
    'No se encontró',
  );
  await expect(
    setTaskLocation(owner, task.id, { ...location, accuracy: NaN }),
  ).rejects.toThrow('no es válida');
  expect(await getTasks(owner)).toEqual([task]);
});

test('el store recupera la ubicación al reiniciar y permite quitarla', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  store().setOwner(owner);
  await store().loadTasks();
  expect(await store().captureLocation(task.id)).toBe(true);
  expect(store().tasks[0].location).toEqual(location);
  store().setOwner(null);
  store().setOwner(owner);
  await store().loadTasks();
  expect(store().tasks[0].location).toEqual(location);
  await store().removeLocation(task.id);
  expect(store().tasks[0].location).toBeNull();
});

test('bloquea dobles solicitudes y descarta resultados de una sesión anterior', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  store().setOwner(owner);
  await store().loadTasks();
  let resolve!: (value: TaskLocation) => void;
  jest.mocked(locationService.getTaskLocation).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  const pending = store().captureLocation(task.id);
  expect(await store().captureLocation(task.id)).toBe(false);
  store().setOwner('user:juan');
  resolve(location);
  expect(await pending).toBe(false);
  expect(store().tasks).toEqual([]);
  expect(await getTasks(owner)).toEqual([task]);
});

test('un error de GPS libera las acciones y mantiene la ubicación previa', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  await setTaskLocation(owner, task.id, location);
  store().setOwner(owner);
  await store().loadTasks();
  jest
    .mocked(locationService.getTaskLocation)
    .mockRejectedValueOnce(new Error('Sin señal'));
  await expect(store().captureLocation(task.id)).rejects.toThrow('Sin señal');
  expect(store().mutation).toBeNull();
  expect(store().tasks[0].location).toEqual(location);
});
