import AsyncStorage from '@react-native-async-storage/async-storage';
import notifee from '@notifee/react-native';
import Geolocation from '@react-native-community/geolocation';
import Contacts, { type Contact } from 'react-native-contacts';
import { launchImageLibrary } from 'react-native-image-picker';
import { Dirs, FileSystem } from 'react-native-file-access';
import { FileSystem as mockFiles } from 'react-native-file-access/jest/mock';
import NativeTaskCalendar from '../specs/NativeTaskCalendar';
import { getTasks } from '../src/services/tasks';
import { useTasksStore } from '../src/stores/useTasksStore';

const store = () => useTasksStore.getState();
const owner = 'user:ana';

beforeEach(async () => {
  store().setOwner(null);
  await AsyncStorage.clear();
  jest.clearAllMocks();
  mockFiles.filesystem.clear();
  mockFiles.filesystem.set('/cache/photo.jpg', 'photo');
});

afterEach(() => {
  store().setOwner(null);
  mockFiles.filesystem.clear();
  jest.restoreAllMocks();
});

test('combina todos los recursos y los conserva al completar, recargar y cambiar de usuario', async () => {
  store().setOwner(owner);
  await store().addTask({
    title: 'Preparar la exposición',
    reminderSeconds: 300,
  });
  const original = store().tasks[0];

  jest.mocked(launchImageLibrary).mockResolvedValueOnce({
    assets: [{ uri: 'file:///cache/photo.jpg', type: 'image/jpeg' }],
  });
  await store().attachImage(original.id, 'gallery');
  const imagePath = store().tasks[0].imagePath;
  expect(imagePath).toBeTruthy();

  jest
    .mocked(Geolocation.getCurrentPosition)
    .mockImplementationOnce(success => {
      success({
        coords: {
          latitude: -34.6,
          longitude: -58.4,
          accuracy: 15,
          altitude: null,
          altitudeAccuracy: null,
          heading: null,
          speed: null,
        },
        timestamp: Date.now(),
      });
    });
  await store().captureLocation(original.id);
  const location = store().tasks[0].location;
  expect(location).toMatchObject({ latitude: -34.6, longitude: -58.4 });

  jest
    .mocked(Contacts.getAllWithoutPhotos)
    .mockResolvedValueOnce([
      {
        recordID: 'person-1',
        givenName: 'María',
        familyName: 'Pérez',
        phoneNumbers: [],
        emailAddresses: [],
      } as unknown as Contact,
    ]);
  await store().attachContact(original.id, 'person-1');
  const contact = store().tasks[0].contact;
  expect(contact?.name).toBe('María Pérez');

  await store().createCalendarEvent(original.id, {
    calendarId: 'default',
    startAt: new Date(Date.now() + 3600_000).toISOString(),
    durationMinutes: 60,
  });
  const calendarEvent = store().tasks[0].calendarEvent;
  expect(calendarEvent?.eventId).toBe('event-1');
  const attachments = { imagePath, location, contact, calendarEvent };
  expect(store().tasks[0]).toEqual({ ...original, ...attachments });

  await store().updateTask(original.id, { completed: true });
  expect(store().tasks[0]).toEqual({
    ...original,
    ...attachments,
    completed: true,
    notificationId: null,
  });
  expect(notifee.cancelNotification).toHaveBeenCalledWith(
    original.notificationId,
  );
  await store().updateTask(original.id, { completed: false });
  expect(store().tasks[0]).toEqual({ ...original, ...attachments });

  store().setOwner(null);
  store().setOwner('user:juan');
  await store().loadTasks();
  expect(store().tasks).toEqual([]);
  store().setOwner(owner);
  await store().loadTasks();
  expect(store().tasks[0]).toEqual({ ...original, ...attachments });
  expect(await FileSystem.exists(`${Dirs.DocumentDir}/${imagePath}`)).toBe(
    true,
  );

  // Quitar un recurso debe conservar los demás y no volver a crear el evento.
  await store().removeContact(original.id);
  expect(store().tasks[0]).toEqual({
    ...original,
    ...attachments,
    contact: null,
  });
  expect(await getTasks(owner)).toEqual(store().tasks);

  await store().deleteTask(original.id);
  expect(store().tasks).toEqual([]);
  expect(await getTasks(owner)).toEqual([]);
  expect(await FileSystem.exists(`${Dirs.DocumentDir}/${imagePath}`)).toBe(
    false,
  );
  expect(NativeTaskCalendar!.createEvent).toHaveBeenCalledTimes(1);
});
