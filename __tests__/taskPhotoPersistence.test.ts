import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import { Dirs, FileSystem } from 'react-native-file-access';
import { FileSystem as mockFiles } from 'react-native-file-access/jest/mock';
import { launchImageLibrary } from 'react-native-image-picker';
import {
  addTask,
  getTasks,
  setTaskImage,
  deleteTask,
  tasksStorageKey,
} from '../src/services/tasks';
import { useTasksStore } from '../src/stores/useTasksStore';
import * as imageService from '../src/services/taskImages';

const owner = 'user:ana';
const draft = { title: 'Repasar', reminderSeconds: 0 };
const photo = { uri: 'file:///cache/photo.jpg', extension: 'jpg' };
const store = () => useTasksStore.getState();

beforeEach(async () => {
  store().setOwner(null);
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockFiles.filesystem.clear();
  mockFiles.filesystem.set('/cache/photo.jpg', 'photo');
});
afterEach(() => {
  store().setOwner(null);
  jest.restoreAllMocks();
});

test('adjunta, persiste, reemplaza y quita la foto sin modificar recordatorios', async () => {
  const task = await addTask(owner, { ...draft, reminderSeconds: 300 });
  jest.clearAllMocks();
  const first = await setTaskImage(owner, task.id, photo);
  expect(await getTasks(owner)).toEqual([first]);
  expect(first.notificationId).toBe(task.notificationId);
  const second = await setTaskImage(owner, task.id, photo);
  expect(
    await FileSystem.exists(`${Dirs.DocumentDir}/${first.imagePath}`),
  ).toBe(false);
  expect(
    await FileSystem.exists(`${Dirs.DocumentDir}/${second.imagePath}`),
  ).toBe(true);
  await setTaskImage(owner, task.id, null);
  expect((await getTasks(owner))[0].imagePath).toBeNull();
  expect(
    await FileSystem.exists(`${Dirs.DocumentDir}/${second.imagePath}`),
  ).toBe(false);
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  expect(notifee.cancelNotification).not.toHaveBeenCalled();
});

test('si falla guardar conserva la foto anterior y descarta la nueva copia', async () => {
  const task = await addTask(owner, draft);
  const previous = await setTaskImage(owner, task.id, photo);
  const files = [...mockFiles.filesystem.entries()];
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('disk full'));
  await expect(setTaskImage(owner, task.id, photo)).rejects.toThrow(
    'No se pudo guardar la foto de la tarea',
  );
  expect(await getTasks(owner)).toEqual([previous]);
  expect([...mockFiles.filesystem.entries()]).toEqual(files);
});

test('si falla quitar o eliminar mantiene tanto el registro como el archivo', async () => {
  const task = await addTask(owner, draft);
  const saved = await setTaskImage(owner, task.id, photo);
  for (const operation of [
    () => setTaskImage(owner, task.id, null),
    () => deleteTask(owner, task.id),
  ]) {
    jest
      .mocked(AsyncStorage.setItem)
      .mockRejectedValueOnce(new Error('disk full'));
    await expect(operation()).rejects.toThrow('Intentá nuevamente');
    expect(await getTasks(owner)).toEqual([saved]);
    expect(
      await FileSystem.exists(`${Dirs.DocumentDir}/${saved.imagePath}`),
    ).toBe(true);
  }
  await deleteTask(owner, task.id);
  expect(
    await FileSystem.exists(`${Dirs.DocumentDir}/${saved.imagePath}`),
  ).toBe(false);
});

test('rechaza fotos en tareas ajenas antes de copiar archivos', async () => {
  const task = await addTask(owner, draft);
  await expect(setTaskImage('user:juan', task.id, photo)).rejects.toThrow(
    'No se encontró',
  );
  expect(FileSystem.cp).not.toHaveBeenCalled();
});

test('lee tareas anteriores sin imagen y rechaza rutas inválidas sin borrar datos', async () => {
  const task = await addTask(owner, draft);
  const old = { ...task };
  delete old.imagePath;
  await AsyncStorage.setItem(tasksStorageKey(owner), JSON.stringify([old]));
  expect(await getTasks(owner)).toEqual([old]);
  const invalid = JSON.stringify([{ ...task, imagePath: '../../users' }]);
  await AsyncStorage.setItem(tasksStorageKey(owner), invalid);
  await expect(getTasks(owner)).rejects.toThrow('formato inválido');
  expect(await AsyncStorage.getItem(tasksStorageKey(owner))).toBe(invalid);
});

test('el store refleja la foto guardada y la recupera tras reiniciar la sesión', async () => {
  const task = await addTask(owner, draft);
  store().setOwner(owner);
  await store().loadTasks();
  jest
    .mocked(launchImageLibrary)
    .mockResolvedValueOnce({
      assets: [{ uri: photo.uri, type: 'image/jpeg' }],
    });
  expect(await store().attachImage(task.id, 'gallery')).toBe(true);
  const saved = store().tasks[0];
  expect(saved.imagePath).toBeTruthy();
  store().setOwner(null);
  store().setOwner(owner);
  await store().loadTasks();
  expect(store().tasks).toEqual([saved]);
  expect(await store().removeImage(task.id)).toBe(true);
  expect(store().tasks[0].imagePath).toBeNull();
});

test('cancelar el selector no modifica la tarea ni copia archivos', async () => {
  const task = await addTask(owner, draft);
  store().setOwner(owner);
  await store().loadTasks();
  jest.clearAllMocks();
  jest.mocked(launchImageLibrary).mockResolvedValueOnce({ didCancel: true });
  expect(await store().attachImage(task.id, 'gallery')).toBe(false);
  expect(store().tasks).toEqual([task]);
  expect(FileSystem.cp).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('una selección pendiente bloquea duplicados y se descarta si cambia la sesión', async () => {
  const task = await addTask(owner, draft);
  store().setOwner(owner);
  await store().loadTasks();
  let resolve!: (image: imageService.SelectedImage) => void;
  jest.spyOn(imageService, 'pickTaskImage').mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  const pending = store().attachImage(task.id, 'gallery');
  expect(await store().attachImage(task.id, 'gallery')).toBe(false);
  store().setOwner('user:juan');
  resolve(photo);
  expect(await pending).toBe(false);
  expect(store().tasks).toEqual([]);
  expect(await getTasks(owner)).toEqual([task]);
  expect(FileSystem.cp).not.toHaveBeenCalled();
});
