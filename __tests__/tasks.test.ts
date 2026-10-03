import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  addTask,
  deleteTask,
  getTasks,
  setTaskCompleted,
  tasksStorageKey,
} from '../src/services/tasks';
import { validateTask } from '../src/utils/tasks';

beforeEach(async () => {
  await AsyncStorage.clear();
  jest.clearAllMocks();
});
afterEach(() => jest.restoreAllMocks());

const owner = 'user:ana';
const draft = { title: 'Repasar', reminderSeconds: 0 };

test('guarda el título limpio y todos los datos, y los vuelve a leer del almacenamiento', async () => {
  const now = Date.parse('2026-10-03T15:00:00.000Z');
  jest.spyOn(Date, 'now').mockReturnValue(now);
  const task = await addTask(owner, {
    title: '  Repasar  ',
    reminderSeconds: 60,
  });
  expect(task).toMatchObject({
    userId: owner,
    title: 'Repasar',
    completed: false,
    createdAt: '2026-10-03T15:00:00.000Z',
    reminderAt: '2026-10-03T15:01:00.000Z',
    notificationId: null,
  });
  expect(task.id).not.toBe('');
  expect(
    JSON.parse((await AsyncStorage.getItem(tasksStorageKey(owner)))!),
  ).toEqual([task]);
  expect(await getTasks(owner)).toEqual([task]);
});

test('permite tareas sin recordatorio y títulos repetidos con identificadores diferentes', async () => {
  const first = await addTask(owner, draft);
  const second = await addTask(owner, draft);
  expect(first.reminderAt).toBeNull();
  expect(first.id).not.toBe(second.id);
  await deleteTask(owner, first.id);
  expect(await getTasks(owner)).toEqual([second]);
});

test('aísla las tareas por usuario e impide eliminar una tarea ajena', async () => {
  const ana = await addTask(owner, draft);
  const juan = await addTask('user:juan', {
    title: 'Comprar',
    reminderSeconds: 0,
  });
  await expect(deleteTask('user:juan', ana.id)).rejects.toThrow(
    'No se encontró esa tarea',
  );
  expect(await getTasks(owner)).toEqual([ana]);
  expect(await getTasks('user:juan')).toEqual([juan]);
  await deleteTask(owner, ana.id);
  expect(await getTasks(owner)).toEqual([]);
  expect(await getTasks('user:juan')).toEqual([juan]);
});

test.each(['', '   ', 'a'.repeat(121)])(
  'rechaza títulos inválidos antes de escribir: %j',
  async title => {
    expect(validateTask({ title, reminderSeconds: 0 })).not.toBeNull();
    await expect(
      addTask(owner, { title, reminderSeconds: 0 }),
    ).rejects.toThrow();
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  },
);

test.each([-1, 2, NaN, Infinity])(
  'rechaza recordatorios inválidos: %s',
  async reminderSeconds => {
    await expect(
      addTask(owner, { title: 'Repasar', reminderSeconds }),
    ).rejects.toThrow('recordatorio válida');
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  },
);

test('rechaza operaciones sin usuario', async () => {
  await expect(getTasks('')).rejects.toThrow('Iniciá sesión');
  await expect(addTask('', draft)).rejects.toThrow('Iniciá sesión');
  await expect(deleteTask('', 'id')).rejects.toThrow('Iniciá sesión');
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('un fallo al guardar conserva las tareas previas y permite reintentar', async () => {
  const first = await addTask(owner, draft);
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk error'));
  await expect(
    addTask(owner, { title: 'Otra', reminderSeconds: 30 }),
  ).rejects.toThrow('No se pudo guardar la tarea.');
  expect(await getTasks(owner)).toEqual([first]);
  const second = await addTask(owner, { title: 'Otra', reminderSeconds: 30 });
  expect(await getTasks(owner)).toEqual([second, first]);
});

test('un fallo al eliminar mantiene la tarea guardada', async () => {
  const task = await addTask(owner, draft);
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk error'));
  await expect(deleteTask(owner, task.id)).rejects.toThrow(
    'No se pudo eliminar la tarea.',
  );
  expect(await getTasks(owner)).toEqual([task]);
});

test('un fallo de lectura nunca reemplaza las tareas por una lista vacía', async () => {
  const task = await addTask(owner, draft);
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('Read error'));
  await expect(addTask(owner, draft)).rejects.toThrow(
    'No se pudieron cargar las tareas.',
  );
  expect(await getTasks(owner)).toEqual([task]);
});

test.each(['{invalid', 'null', '{}', '[{"id":"1"}]'])(
  'conserva datos corruptos: %s',
  async raw => {
    await AsyncStorage.setItem(tasksStorageKey(owner), raw);
    await expect(getTasks(owner)).rejects.toThrow('formato inválido');
    await expect(addTask(owner, draft)).rejects.toThrow('formato inválido');
    await expect(deleteTask(owner, '1')).rejects.toThrow('formato inválido');
    expect(await AsyncStorage.getItem(tasksStorageKey(owner))).toBe(raw);
  },
);

test('no muestra registros de otro propietario aunque estén en la clave equivocada', async () => {
  const task = await addTask('user:juan', draft);
  await AsyncStorage.setItem(tasksStorageKey(owner), JSON.stringify([task]));
  await expect(getTasks(owner)).rejects.toThrow('formato inválido');
});

test('serializa guardados y eliminaciones simultáneos sin perder tareas', async () => {
  const [first, second] = await Promise.all([
    addTask(owner, draft),
    addTask(owner, { title: 'Comprar', reminderSeconds: 0 }),
  ]);
  const [, third] = await Promise.all([
    deleteTask(owner, first.id),
    addTask(owner, { title: 'Leer', reminderSeconds: 0 }),
  ]);
  expect(await getTasks(owner)).toEqual([third, second]);
});

test('lee tareas anteriores sin estado como pendientes y las conserva al completar', async () => {
  const task = await addTask(owner, draft);
  const legacy = JSON.parse(JSON.stringify(task));
  delete legacy.completed;
  await AsyncStorage.setItem(tasksStorageKey(owner), JSON.stringify([legacy]));
  expect(await getTasks(owner)).toEqual([task]);
  expect(await setTaskCompleted(owner, task.id, true)).toEqual({
    ...task,
    completed: true,
  });
  expect(await getTasks(owner)).toEqual([{ ...task, completed: true }]);
  await setTaskCompleted(owner, task.id, false);
  expect(await getTasks(owner)).toEqual([task]);
});

test('no permite cambiar el estado de tareas de otro usuario', async () => {
  const task = await addTask(owner, draft);
  await expect(setTaskCompleted('user:juan', task.id, true)).rejects.toThrow(
    'No se encontró esa tarea',
  );
  expect(await getTasks(owner)).toEqual([task]);
  expect(await getTasks('user:juan')).toEqual([]);
});

test('si falla actualizar conserva el estado anterior y permite reintentar', async () => {
  const task = await addTask(owner, draft);
  jest
    .mocked(AsyncStorage.setItem)
    .mockRejectedValueOnce(new Error('Disk error'));
  await expect(setTaskCompleted(owner, task.id, true)).rejects.toThrow(
    'No se pudo actualizar la tarea',
  );
  expect(await getTasks(owner)).toEqual([task]);
  await setTaskCompleted(owner, task.id, true);
  expect(await getTasks(owner)).toEqual([{ ...task, completed: true }]);
});

test('serializa completar y crear sin perder tareas ni cambios de estado', async () => {
  const first = await addTask(owner, draft);
  const [updated, second] = await Promise.all([
    setTaskCompleted(owner, first.id, true),
    addTask(owner, { title: 'Otra', reminderSeconds: 0 }),
  ]);
  expect(await getTasks(owner)).toEqual([second, updated]);
  expect(updated.completed).toBe(true);
});

test('rechaza estados inválidos sin reemplazar los datos guardados', async () => {
  const task = await addTask(owner, draft);
  const raw = JSON.stringify([{ ...task, completed: 'true' }]);
  await AsyncStorage.setItem(tasksStorageKey(owner), raw);
  await expect(getTasks(owner)).rejects.toThrow('formato inválido');
  expect(await AsyncStorage.getItem(tasksStorageKey(owner))).toBe(raw);
});
