import { Linking, Platform } from 'react-native';
import notifee, {
  AlarmType,
  AndroidImportance,
  AndroidNotificationSetting,
  AuthorizationStatus,
  TriggerType,
} from '@notifee/react-native';
import type { Task } from '../types/task';

export const REMINDERS_CHANNEL_ID = 'task-reminders';
type SettingsTarget = 'notifications' | 'alarms' | 'channel';

export class ReminderPermissionError extends Error {
  constructor(message: string, public readonly settingsTarget: SettingsTarget) {
    super(message);
    this.name = 'ReminderPermissionError';
  }
}

// Se ejecuta antes de calcular el plazo: responder al permiso no consume los 10 segundos.
export async function prepareReminder(): Promise<void> {
  const settings = await notifee.requestPermission({
    alert: true,
    sound: true,
    badge: false,
  });
  if (settings.authorizationStatus < AuthorizationStatus.AUTHORIZED) {
    throw new ReminderPermissionError(
      'Permití las notificaciones en Ajustes y volvé a guardar, o elegí Sin recordatorio.',
      'notifications',
    );
  }
  if (Platform.OS === 'android') {
    await notifee.createChannel({
      id: REMINDERS_CHANNEL_ID,
      name: 'Recordatorios de tareas',
      importance: AndroidImportance.HIGH,
      sound: 'default',
    });
    if (await notifee.isChannelBlocked(REMINDERS_CHANNEL_ID)) {
      throw new ReminderPermissionError(
        'Habilitá el canal Recordatorios de tareas en Ajustes.',
        'channel',
      );
    }
    if (Number(Platform.Version) >= 31) {
      const current = await notifee.getNotificationSettings();
      if (current.android.alarm !== AndroidNotificationSetting.ENABLED) {
        throw new ReminderPermissionError(
          'Permití Alarmas y recordatorios para avisarte a la hora elegida. Después volvé e intentá nuevamente.',
          'alarms',
        );
      }
    }
  }
}

export function reminderId(task: Pick<Task, 'userId' | 'id'>): string {
  return `task:${encodeURIComponent(task.userId)}:${task.id}`;
}

export async function scheduleReminder(task: Task): Promise<void> {
  if (!task.notificationId || !task.reminderAt || task.completed) {
    return;
  }
  const timestamp = Date.parse(task.reminderAt);
  if (!Number.isFinite(timestamp) || timestamp <= Date.now()) {
    throw new Error(
      'La fecha del recordatorio ya pasó. Intentá guardar nuevamente.',
    );
  }
  try {
    await notifee.createTriggerNotification(
      {
        id: task.notificationId,
        title: 'Tarea pendiente',
        body: task.title,
        data: { taskId: task.id, userId: task.userId },
        android: {
          channelId: REMINDERS_CHANNEL_ID,
          smallIcon: 'ic_notification',
          pressAction: { id: 'default' },
        },
        ios: {
          sound: 'default',
          foregroundPresentationOptions: {
            banner: true,
            list: true,
            sound: true,
            badge: false,
          },
        },
      },
      {
        type: TriggerType.TIMESTAMP,
        timestamp,
        ...(Platform.OS === 'android'
          ? { alarmManager: { type: AlarmType.SET_EXACT_AND_ALLOW_WHILE_IDLE } }
          : {}),
      },
    );
  } catch {
    throw new Error(
      'No se pudo programar el recordatorio. Intentá nuevamente o elegí Sin recordatorio.',
    );
  }
}

export async function cancelReminder(notificationId: string): Promise<void> {
  try {
    // Cancela tanto el disparador futuro como un aviso que ya esté visible.
    await notifee.cancelNotification(notificationId);
  } catch {
    throw new Error('No se pudo cancelar el recordatorio. Intentá nuevamente.');
  }
}

export async function openReminderSettings(
  target: SettingsTarget,
): Promise<void> {
  if (Platform.OS === 'ios') {
    await Linking.openSettings();
  } else if (target === 'alarms') {
    await notifee.openAlarmPermissionSettings();
  } else {
    await notifee.openNotificationSettings(
      target === 'channel' ? REMINDERS_CHANNEL_ID : undefined,
    );
  }
}
