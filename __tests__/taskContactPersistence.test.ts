import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import {
  addTask,
  getTasks,
  setTaskContact,
  tasksStorageKey,
} from '../src/services/tasks';
import * as contactsService from '../src/services/taskContacts';
import { useTasksStore } from '../src/stores/useTasksStore';
import type { TaskContact } from '../src/types/task';

const owner = 'user:ana';
const contact: TaskContact = {
  recordId: '1',
  name: 'José Pérez',
  phone: null,
  email: 'jose@example.com',
};
const store = () => useTasksStore.getState();

beforeEach(async () => {
  store().setOwner(null);
  await AsyncStorage.clear();
  jest.clearAllMocks();
  jest.spyOn(contactsService, 'getDeviceContact').mockResolvedValue(contact);
});
afterEach(() => {
  store().setOwner(null);
  jest.restoreAllMocks();
});

test('guarda, cambia y quita el contacto sin modificar recordatorios ni el resto de la tarea', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 300 });
  jest.clearAllMocks();
  await setTaskContact(owner, task.id, contact);
  expect(await getTasks(owner)).toEqual([{ ...task, contact }]);
  await setTaskContact(owner, task.id, {
    ...contact,
    recordId: '2',
    name: 'María',
  });
  expect((await getTasks(owner))[0].contact?.name).toBe('María');
  await setTaskContact(owner, task.id, null);
  expect(await getTasks(owner)).toEqual([task]);
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
  expect(notifee.cancelNotification).not.toHaveBeenCalled();
});

test('si falla cambiar o quitar, conserva el contacto previo y permite reintentar', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  const saved = await setTaskContact(owner, task.id, contact);
  for (const next of [{ ...contact, name: 'María' }, null]) {
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('disk'));
    await expect(setTaskContact(owner, task.id, next)).rejects.toThrow(
      'No se pudo guardar el contacto',
    );
    expect(await getTasks(owner)).toEqual([saved]);
  }
  await setTaskContact(owner, task.id, null);
  expect((await getTasks(owner))[0].contact).toBeNull();
});

test('lee tareas antiguas y conserva datos corruptos sin sobrescribirlos', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  const old = { ...task };
  delete old.contact;
  await AsyncStorage.setItem(tasksStorageKey(owner), JSON.stringify([old]));
  expect(await getTasks(owner)).toEqual([old]);
  const invalid = JSON.stringify([
    { ...task, contact: { ...contact, recordId: null } },
  ]);
  await AsyncStorage.setItem(tasksStorageKey(owner), invalid);
  await expect(setTaskContact(owner, task.id, contact)).rejects.toThrow(
    'formato inválido',
  );
  expect(await AsyncStorage.getItem(tasksStorageKey(owner))).toBe(invalid);
});

test('rechaza contactos inválidos y tareas ajenas antes de acceder a la agenda', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  store().setOwner('user:juan');
  await store().loadTasks();
  await expect(store().attachContact(task.id, '1')).rejects.toThrow(
    'No se encontró',
  );
  expect(contactsService.getDeviceContact).not.toHaveBeenCalled();
  await expect(setTaskContact('user:juan', task.id, contact)).rejects.toThrow(
    'No se encontró',
  );
  await expect(
    setTaskContact(owner, task.id, { ...contact, name: '' }),
  ).rejects.toThrow('no es válido');
  expect(await getTasks(owner)).toEqual([task]);
});

test('recupera el contacto al reiniciar y permite quitarlo sin volver a leer la agenda', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  store().setOwner(owner);
  await store().loadTasks();
  expect(await store().attachContact(task.id, '1')).toBe(true);
  store().setOwner(null);
  store().setOwner(owner);
  await store().loadTasks();
  expect(store().tasks[0].contact).toEqual(contact);
  jest.clearAllMocks();
  await store().removeContact(task.id);
  expect(store().tasks[0].contact).toBeNull();
  expect(contactsService.getDeviceContact).not.toHaveBeenCalled();
});

test('bloquea selecciones simultáneas y descarta respuestas si cambia la sesión', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  store().setOwner(owner);
  await store().loadTasks();
  let resolve!: (value: TaskContact) => void;
  jest.mocked(contactsService.getDeviceContact).mockReturnValueOnce(
    new Promise(done => {
      resolve = done;
    }),
  );
  const pending = store().attachContact(task.id, '1');
  expect(await store().attachContact(task.id, '1')).toBe(false);
  store().setOwner('user:juan');
  resolve(contact);
  expect(await pending).toBe(false);
  expect(store().tasks).toEqual([]);
  expect(await getTasks(owner)).toEqual([task]);
});

test('conserva el contacto anterior si la nueva selección ya no está disponible', async () => {
  const task = await addTask(owner, { title: 'Repasar', reminderSeconds: 0 });
  await setTaskContact(owner, task.id, contact);
  store().setOwner(owner);
  await store().loadTasks();
  jest
    .mocked(contactsService.getDeviceContact)
    .mockRejectedValueOnce(
      new contactsService.ContactsError('Contacto no disponible'),
    );
  await expect(store().attachContact(task.id, '2')).rejects.toThrow(
    'no disponible',
  );
  expect(store().mutation).toBeNull();
  expect(store().tasks[0].contact).toEqual(contact);
});
