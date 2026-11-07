import NativeTaskCalendar from '../specs/NativeTaskCalendar';
import * as permissions from '../src/services/devicePermissions';
import {
  CalendarError,
  createDeviceCalendarEvent,
  listDeviceCalendars,
} from '../src/services/taskCalendar';
import {
  initialEventDate,
  isTaskCalendarEvent,
  validateCalendarEvent,
} from '../src/utils/calendar';
import type { Task } from '../src/types/task';

const task: Task = {
  id: 'task-1',
  userId: 'user:ana',
  title: 'Repasar',
  completed: false,
  createdAt: '2026-01-01T12:00:00.000Z',
  reminderAt: null,
  notificationId: null,
  location: {
    latitude: -34.6,
    longitude: -58.4,
    accuracy: 20,
    capturedAt: '2026-01-01T12:00:00.000Z',
  },
};
const draft = () => ({
  calendarId: 'default',
  startAt: new Date(Date.now() + 3600_000).toISOString(),
  durationMinutes: 60,
});

beforeEach(() => {
  jest.clearAllMocks();
  jest
    .spyOn(permissions, 'requestResourcePermission')
    .mockResolvedValue('granted');
  jest
    .spyOn(permissions, 'checkResourcePermission')
    .mockResolvedValue('granted');
});
afterEach(() => jest.restoreAllMocks());

test('solicita permiso antes de consultar calendarios y permite volver de ajustes sin otro diálogo', async () => {
  expect(await listDeviceCalendars()).toEqual([
    { id: 'default', title: 'Calendario predeterminado' },
  ]);
  expect(permissions.requestResourcePermission).toHaveBeenCalledWith(
    'calendar',
  );
  expect(
    jest.mocked(permissions.requestResourcePermission).mock
      .invocationCallOrder[0],
  ).toBeLessThan(
    jest.mocked(NativeTaskCalendar!.getCalendars).mock.invocationCallOrder[0],
  );
  jest.clearAllMocks();
  await listDeviceCalendars(false);
  expect(permissions.checkResourcePermission).toHaveBeenCalledWith('calendar');
  expect(permissions.requestResourcePermission).not.toHaveBeenCalled();
});

test.each(['denied', 'blocked', 'unavailable'] as const)(
  'no accede al calendario con permiso %s',
  async permission => {
    jest
      .mocked(permissions.requestResourcePermission)
      .mockResolvedValueOnce(permission);
    await expect(listDeviceCalendars()).rejects.toBeInstanceOf(CalendarError);
    expect(NativeTaskCalendar!.getCalendars).not.toHaveBeenCalled();
    jest
      .mocked(permissions.checkResourcePermission)
      .mockResolvedValueOnce(permission);
    await expect(
      createDeviceCalendarEvent(task, draft()),
    ).rejects.toBeInstanceOf(CalendarError);
    expect(NativeTaskCalendar!.createEvent).not.toHaveBeenCalled();
  },
);

test('distingue calendario vacío y fallo nativo', async () => {
  jest.mocked(NativeTaskCalendar!.getCalendars).mockResolvedValueOnce([]);
  expect(await listDeviceCalendars()).toEqual([]);
  jest
    .mocked(NativeTaskCalendar!.getCalendars)
    .mockRejectedValueOnce(new Error('No se pudo leer'));
  await expect(listDeviceCalendars()).rejects.toThrow('No se pudo leer');
});

test('crea un evento con fecha, duración, título y ubicación de la tarea', async () => {
  const data = draft();
  const start = Date.parse(data.startAt);
  const saved = await createDeviceCalendarEvent(task, data);
  expect(NativeTaskCalendar!.createEvent).toHaveBeenCalledWith(
    JSON.stringify([task.userId, task.id]),
    'default',
    'Repasar',
    start,
    start + 3600_000,
    expect.stringContaining('task-1'),
    '-34.6, -58.4',
  );
  expect(saved).toEqual({
    eventId: 'event-1',
    calendarId: 'default',
    calendarName: 'Calendario predeterminado',
    startAt: data.startAt,
    endAt: new Date(start + 3600_000).toISOString(),
  });
  expect(permissions.requestResourcePermission).not.toHaveBeenCalled();
});

test('conserva las fechas devueltas por el módulo al recuperar una creación anterior', async () => {
  const start = Date.now() - 3600_000;
  jest.mocked(NativeTaskCalendar!.createEvent).mockResolvedValueOnce({
    eventId: 'saved',
    calendarId: 'original',
    calendarName: 'Original',
    startDate: start,
    endDate: start + 1800_000,
  });
  expect(await createDeviceCalendarEvent(task, draft())).toMatchObject({
    eventId: 'saved',
    calendarId: 'original',
    startAt: new Date(start).toISOString(),
  });
});

test('rechaza datos inválidos antes de pedir permisos y no crea si cambió la sesión', async () => {
  await expect(
    createDeviceCalendarEvent(task, { ...draft(), startAt: 'invalid' }),
  ).rejects.toThrow('fecha válida');
  expect(permissions.checkResourcePermission).not.toHaveBeenCalled();
  expect(
    await createDeviceCalendarEvent(task, draft(), () => false),
  ).toBeNull();
  expect(NativeTaskCalendar!.createEvent).not.toHaveBeenCalled();
});

test('expone los rechazos nativos sin fingir un evento guardado', async () => {
  jest
    .mocked(NativeTaskCalendar!.createEvent)
    .mockRejectedValueOnce({ code: 'permission', message: 'Permiso revocado' });
  await expect(createDeviceCalendarEvent(task, draft())).rejects.toMatchObject({
    message: 'Permiso revocado',
    settingsAvailable: true,
  });
  jest
    .mocked(NativeTaskCalendar!.createEvent)
    .mockResolvedValueOnce({
      eventId: '',
      calendarId: 'a',
      calendarName: 'A',
      startDate: 1,
      endDate: 2,
    });
  await expect(createDeviceCalendarEvent(task, draft())).rejects.toThrow(
    'resultado inválido',
  );
});

test('valida calendario, fechas futuras y duraciones permitidas', () => {
  expect(validateCalendarEvent(draft())).toBeNull();
  expect(validateCalendarEvent({ ...draft(), calendarId: ' ' })).toContain(
    'calendario',
  );
  expect(
    validateCalendarEvent({ ...draft(), startAt: new Date(0).toISOString() }),
  ).toContain('futuras');
  expect(validateCalendarEvent({ ...draft(), durationMinutes: -1 })).toContain(
    'duración',
  );
  expect(initialEventDate(null).getTime()).toBeGreaterThan(Date.now());
  const future = draft().startAt;
  expect(initialEventDate(future).toISOString()).toBe(future);
  expect(initialEventDate('invalid').getTime()).toBeGreaterThan(Date.now());
  expect(
    isTaskCalendarEvent({
      eventId: '1',
      calendarId: '1',
      calendarName: 'A',
      startAt: future,
      endAt: future,
    }),
  ).toBe(false);
});
