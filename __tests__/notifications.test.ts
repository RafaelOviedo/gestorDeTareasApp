import { Linking, Platform } from 'react-native';
import notifee, {
  AlarmType,
  AndroidImportance,
  AndroidNotificationSetting,
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';
import {
  cancelReminder,
  openReminderSettings,
  prepareReminder,
  reminderId,
  REMINDERS_CHANNEL_ID,
  scheduleReminder,
} from '../src/services/notifications';
import type { Task } from '../src/types/task';

const originalOS = Object.getOwnPropertyDescriptor(Platform, 'OS')!;
const originalVersion = Object.getOwnPropertyDescriptor(Platform, 'Version')!;
function platform(os: 'ios' | 'android', version: number) {
  Object.defineProperty(Platform, 'OS', { configurable: true, value: os });
  Object.defineProperty(Platform, 'Version', {
    configurable: true,
    value: version,
  });
}
const task: Task = {
  id: 'demo',
  userId: 'user:ana',
  title: 'Mostrar el parcial',
  completed: false,
  createdAt: '2026-10-03T15:00:00.000Z',
  reminderAt: '2026-10-03T15:00:10.000Z',
  notificationId: 'task:user%3Aana:demo',
};
beforeEach(() => {
  jest.clearAllMocks();
  platform('ios', 26);
  jest.spyOn(Date, 'now').mockReturnValue(Date.parse(task.createdAt));
});
afterEach(() => {
  jest.restoreAllMocks();
  Object.defineProperty(Platform, 'OS', originalOS);
  Object.defineProperty(Platform, 'Version', originalVersion);
});

test('iOS programa una sola notificación local con título, sonido y banner en primer plano', async () => {
  await prepareReminder();
  await scheduleReminder(task);
  expect(notifee.requestPermission).toHaveBeenCalledWith({
    alert: true,
    sound: true,
    badge: false,
  });
  expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      id: task.notificationId,
      body: task.title,
      data: { taskId: task.id, userId: task.userId },
      ios: {
        sound: 'default',
        foregroundPresentationOptions: {
          banner: true,
          list: true,
          sound: true,
          badge: false,
        },
      },
    }),
    { type: TriggerType.TIMESTAMP, timestamp: Date.parse(task.reminderAt!) },
  );
  expect(notifee.createChannel).not.toHaveBeenCalled();
});

test('Android crea un canal visible y usa alarma exacta para el intervalo corto', async () => {
  platform('android', 33);
  await prepareReminder();
  await scheduleReminder(task);
  expect(notifee.createChannel).toHaveBeenCalledWith({
    id: REMINDERS_CHANNEL_ID,
    name: 'Recordatorios de tareas',
    importance: AndroidImportance.HIGH,
    sound: 'default',
  });
  expect(notifee.createTriggerNotification).toHaveBeenCalledWith(
    expect.objectContaining({
      android: {
        channelId: REMINDERS_CHANNEL_ID,
        smallIcon: 'ic_notification',
        pressAction: { id: 'default' },
      },
    }),
    {
      type: TriggerType.TIMESTAMP,
      timestamp: Date.parse(task.reminderAt!),
      alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE },
    },
  );
});

test('permiso rechazado explica cómo habilitarlo y no programa avisos', async () => {
  const settings = await notifee.getNotificationSettings();
  jest
    .mocked(notifee.requestPermission)
    .mockResolvedValueOnce({
      ...settings,
      authorizationStatus: AuthorizationStatus.DENIED,
    });
  await expect(prepareReminder()).rejects.toMatchObject({
    settingsTarget: 'notifications',
  });
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
});

test('Android 12+ exige permiso de alarmas exactas y ofrece sus ajustes', async () => {
  platform('android', 31);
  const settings = await notifee.getNotificationSettings();
  jest
    .mocked(notifee.getNotificationSettings)
    .mockResolvedValueOnce({
      ...settings,
      android: { alarm: AndroidNotificationSetting.DISABLED },
    });
  await expect(prepareReminder()).rejects.toMatchObject({
    settingsTarget: 'alarms',
  });
  await openReminderSettings('alarms');
  expect(notifee.openAlarmPermissionSettings).toHaveBeenCalledTimes(1);
});

test('Android anterior a 12 no exige permiso de alarmas exactas', async () => {
  platform('android', 30);
  await prepareReminder();
  expect(notifee.getNotificationSettings).not.toHaveBeenCalled();
});

test('un canal bloqueado lleva a sus ajustes específicos', async () => {
  platform('android', 33);
  jest.mocked(notifee.isChannelBlocked).mockResolvedValueOnce(true);
  await expect(prepareReminder()).rejects.toMatchObject({
    settingsTarget: 'channel',
  });
  await openReminderSettings('channel');
  expect(notifee.openNotificationSettings).toHaveBeenCalledWith(
    REMINDERS_CHANNEL_ID,
  );
});

test('iOS abre los ajustes mediante Linking porque Notifee solo los abre en Android', async () => {
  const openSettings = jest
    .spyOn(Linking, 'openSettings')
    .mockResolvedValue(undefined);
  await openReminderSettings('notifications');
  expect(openSettings).toHaveBeenCalledTimes(1);
  expect(notifee.openNotificationSettings).not.toHaveBeenCalled();
});

test('cancelar retira el aviso pendiente o ya visible mediante su id', async () => {
  await cancelReminder(task.notificationId!);
  expect(notifee.cancelNotification).toHaveBeenCalledWith(task.notificationId);
});

test('no programa tareas completadas ni fechas vencidas', async () => {
  await scheduleReminder({ ...task, completed: true });
  await expect(
    scheduleReminder({ ...task, reminderAt: task.createdAt }),
  ).rejects.toThrow('ya pasó');
  expect(notifee.createTriggerNotification).not.toHaveBeenCalled();
});

test('identificadores de notificación separados por usuario aunque coincida el id de tarea', () => {
  expect(reminderId(task)).not.toBe(
    reminderId({ ...task, userId: 'user:juan' }),
  );
});
