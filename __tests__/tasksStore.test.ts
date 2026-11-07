import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import * as taskService from '../src/services/tasks';
import { useTasksStore } from '../src/stores/useTasksStore';
import type { Task } from '../src/types/task';

const owner = 'user:ana';
const otherOwner = 'user:juan';
const draft = { title: 'Repasar', reminderSeconds: 0 };
const store = () => useTasksStore.getState();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((onResolve, onReject) => {
    resolve = onResolve;
    reject = onReject;
  });
  return { promise, resolve, reject };
}

beforeEach(async () => {
  store().setOwner(null);
  await AsyncStorage.clear();
  jest.clearAllMocks();
});

afterEach(() => {
  store().setOwner(null);
  jest.restoreAllMocks();
});

test('carga las tareas existentes y agrega, actualiza y elimina con persistencia', async () => {
  const existing = await taskService.addTask(owner, draft);
  store().setOwner(owner);
  await store().loadTasks();
  expect(store().tasks).toEqual([existing]);
  expect(await store().addTask({ title: 'Comprar', reminderSeconds: 0 })).toBe(
    true,
  );
  const created = store().tasks[0];
  expect(store().tasks).toEqual([created, existing]);
  expect(await store().updateTask(existing.id, { completed: true })).toBe(true);
  expect(store().tasks[1].completed).toBe(true);
  expect(await store().deleteTask(created.id)).toBe(true);
  expect(store().tasks).toEqual(await taskService.getTasks(owner));
  store().setOwner(owner);
  expect(store().tasks).toEqual([]);
  await store().loadTasks();
  expect(store().tasks).toEqual([{ ...existing, completed: true }]);
});

test('sin usuario no carga ni modifica almacenamiento', async () => {
  await store().loadTasks();
  await expect(store().addTask(draft)).rejects.toThrow('Iniciá sesión');
  await expect(store().updateTask('id', { completed: true })).rejects.toThrow(
    'Iniciá sesión',
  );
  await expect(store().deleteTask('id')).rejects.toThrow('Iniciá sesión');
  expect(AsyncStorage.getItem).not.toHaveBeenCalled();
  expect(AsyncStorage.setItem).not.toHaveBeenCalled();
});

test('limpia la lista al cerrar sesión o cambiar de usuario sin borrar datos persistentes', async () => {
  const ana = await taskService.addTask(owner, draft);
  const juan = await taskService.addTask(otherOwner, {
    ...draft,
    title: 'Comprar',
  });
  store().setOwner(owner);
  await store().loadTasks();
  store().setOwner(null);
  expect(store().tasks).toEqual([]);
  expect(store().userId).toBeNull();
  store().setOwner(otherOwner);
  expect(store().tasks).toEqual([]);
  await store().loadTasks();
  expect(store().tasks).toEqual([juan]);
  expect(await taskService.getTasks(owner)).toEqual([ana]);
  await expect(store().deleteTask(ana.id)).rejects.toThrow('No se encontró');
});

test('un error de lectura conserva la lista previa y permite reintentar', async () => {
  const task = await taskService.addTask(owner, draft);
  store().setOwner(owner);
  await store().loadTasks();
  jest
    .mocked(AsyncStorage.getItem)
    .mockRejectedValueOnce(new Error('Read failed'));
  await store().loadTasks();
  expect(store().loadError).toContain('No se pudieron cargar');
  expect(store().isLoading).toBe(false);
  expect(store().tasks).toEqual([task]);
  await store().loadTasks();
  expect(store().loadError).toBeNull();
});

test.each(['crear', 'actualizar', 'eliminar'])(
  'si falla %s conserva el estado previo y libera el bloqueo',
  async operation => {
    const task = await taskService.addTask(owner, draft);
    store().setOwner(owner);
    await store().loadTasks();
    jest
      .mocked(AsyncStorage.setItem)
      .mockRejectedValueOnce(new Error('Write failed'));
    const change = () =>
      operation === 'crear'
        ? store().addTask(draft)
        : operation === 'actualizar'
        ? store().updateTask(task.id, { completed: true })
        : store().deleteTask(task.id);
    await expect(change()).rejects.toThrow('Intentá nuevamente');
    expect(store().tasks).toEqual([task]);
    expect(store().mutation).toBeNull();
    expect(await change()).toBe(true);
  },
);

test('un guardado pendiente bloquea dobles envíos y recargas; publica solo después de persistir', async () => {
  store().setOwner(owner);
  const pending = deferred<void>();
  const originalSetItem = jest
    .mocked(AsyncStorage.setItem)
    .getMockImplementation()!;
  jest
    .mocked(AsyncStorage.setItem)
    .mockImplementationOnce(async (key, value) => {
      await pending.promise;
      await originalSetItem(key, value);
    });
  const first = store().addTask(draft);
  expect(store().mutation?.type).toBe('create');
  expect(store().tasks).toEqual([]);
  expect(await store().addTask(draft)).toBe(false);
  await store().loadTasks();
  expect(store().isLoading).toBe(false);
  pending.resolve();
  expect(await first).toBe(true);
  expect(store().tasks).toHaveLength(1);
  expect(await taskService.getTasks(owner)).toHaveLength(1);
  expect(store().mutation).toBeNull();
});

test('solo aplica la lectura más reciente cuando se solapan recargas', async () => {
  const task = await taskService.addTask(owner, draft);
  store().setOwner(owner);
  const pending = deferred<Task[]>();
  jest
    .spyOn(taskService, 'getTasks')
    .mockImplementationOnce(() => pending.promise);
  const oldRead = store().loadTasks();
  await store().loadTasks();
  pending.resolve([]);
  await oldRead;
  expect(store().tasks).toEqual([task]);
});

test('ignora una lectura antigua incluso al volver a iniciar sesión con el mismo usuario', async () => {
  store().setOwner(owner);
  const pending = deferred<Task[]>();
  jest
    .spyOn(taskService, 'getTasks')
    .mockImplementationOnce(() => pending.promise);
  const oldRead = store().loadTasks();
  store().setOwner(null);
  const task = await taskService.addTask(owner, draft);
  store().setOwner(owner);
  await store().loadTasks();
  pending.resolve([]);
  await oldRead;
  expect(store().tasks).toEqual([task]);
});

test('una escritura anterior no agrega tareas ni desbloquea operaciones de la nueva cuenta', async () => {
  store().setOwner(owner);
  const ana = await taskService.addTask(owner, draft);
  const juan = await taskService.addTask(otherOwner, {
    ...draft,
    title: 'Comprar',
  });
  const first = deferred<Task>();
  const second = deferred<Task>();
  jest
    .spyOn(taskService, 'addTask')
    .mockImplementationOnce(() => first.promise)
    .mockImplementationOnce(() => second.promise);
  const oldWrite = store().addTask(draft);
  store().setOwner(otherOwner);
  const newWrite = store().addTask(draft);
  first.resolve(ana);
  expect(await oldWrite).toBe(false);
  expect(store().tasks).toEqual([]);
  expect(store().mutation?.type).toBe('create');
  second.resolve(juan);
  expect(await newWrite).toBe(true);
  expect(store().tasks).toEqual([juan]);
});

test('un error de carga del usuario anterior no afecta la nueva sesión', async () => {
  store().setOwner(owner);
  const pending = deferred<Task[]>();
  jest
    .spyOn(taskService, 'getTasks')
    .mockImplementationOnce(() => pending.promise);
  const oldRead = store().loadTasks();
  store().setOwner(otherOwner);
  await store().loadTasks();
  pending.reject(new Error('Error de otra sesión'));
  await oldRead;
  expect(store().loadError).toBeNull();
  expect(store().isLoading).toBe(false);
});

test('las acciones del store conservan la programación y cancelación de recordatorios', async () => {
  store().setOwner(owner);
  await store().addTask({ ...draft, reminderSeconds: 300 });
  const task = store().tasks[0];
  expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(1);
  await store().updateTask(task.id, { completed: true });
  expect(notifee.cancelNotification).toHaveBeenCalledWith(task.notificationId);
  expect(store().tasks[0].notificationId).toBeNull();
  await store().updateTask(task.id, { completed: false });
  expect(notifee.createTriggerNotification).toHaveBeenCalledTimes(2);
  await store().deleteTask(task.id);
  expect(store().tasks).toEqual([]);
  expect(notifee.cancelNotification).toHaveBeenCalledTimes(2);
});
