import NativeTaskCalendar, {
  type DeviceCalendar,
  type SavedCalendarEvent,
} from '../../specs/NativeTaskCalendar';
import type {
  CalendarEventDraft,
  Task,
  TaskCalendarEvent,
} from '../types/task';
import { isTaskCalendarEvent, validateCalendarEvent } from '../utils/calendar';
import {
  checkResourcePermission,
  requestResourcePermission,
} from './devicePermissions';

export class CalendarError extends Error {
  constructor(message: string, public readonly settingsAvailable = false) {
    super(message);
    this.name = 'CalendarError';
  }
}

async function authorize(requestAccess: boolean) {
  let permission;
  try {
    permission = await (requestAccess
      ? requestResourcePermission('calendar')
      : checkResourcePermission('calendar'));
  } catch {
    throw new CalendarError(
      'No se pudo consultar el permiso de calendario. Intentá nuevamente.',
    );
  }
  if (permission === 'unavailable') {
    throw new CalendarError(
      'El calendario no está disponible en este dispositivo.',
    );
  }
  if (permission !== 'granted' && permission !== 'limited') {
    throw new CalendarError(
      'Se necesita acceso completo al calendario para consultar y eliminar el evento. Pulsá Actualizar evento para autorizarlo o revisá el permiso en Ajustes.',
      true,
    );
  }
  if (!NativeTaskCalendar) {
    throw new CalendarError(
      'El módulo de calendario no está instalado. Actualizá la aplicación.',
    );
  }
  return NativeTaskCalendar;
}

function nativeError(cause: unknown): CalendarError {
  const error = cause as { code?: string; message?: string } | null;
  return new CalendarError(
    error?.message || 'No se pudo acceder al calendario. Intentá nuevamente.',
    error?.code === 'permission',
  );
}

export async function listDeviceCalendars(
  requestAccess = true,
): Promise<DeviceCalendar[]> {
  const calendar = await authorize(requestAccess);
  try {
    const calendars = await calendar.getCalendars();
    return calendars.filter(item => item.id.trim() && item.title.trim());
  } catch (cause) {
    throw nativeError(cause);
  }
}

export async function createDeviceCalendarEvent(
  task: Task,
  draft: CalendarEventDraft,
  isCurrent: () => boolean = () => true,
): Promise<TaskCalendarEvent | null> {
  const error = validateCalendarEvent(draft);
  if (error) {
    throw new CalendarError(error);
  }
  const calendar = await authorize(false);
  // Un cambio de sesión mientras se consultaba el permiso no debe crear eventos.
  if (!isCurrent()) {
    return null;
  }
  const startDate = Date.parse(draft.startAt);
  try {
    const saved = await calendar.createEvent(
      JSON.stringify(
        task.calendarRevision
          ? [task.userId, task.id, task.calendarRevision]
          : [task.userId, task.id],
      ),
      draft.calendarId,
      task.title,
      startDate,
      startDate + draft.durationMinutes * 60_000,
      `Tarea de Gestor de Tareas: ${task.title}\nReferencia: ${task.id}`,
      task.location
        ? `${task.location.latitude}, ${task.location.longitude}`
        : '',
    );
    return toTaskEvent(saved);
  } catch (cause) {
    throw nativeError(cause);
  }
}

function toTaskEvent(saved: SavedCalendarEvent): TaskCalendarEvent {
  const event: TaskCalendarEvent = {
    eventId: saved.eventId,
    calendarId: saved.calendarId,
    calendarName: saved.calendarName,
    startAt: new Date(saved.startDate).toISOString(),
    endAt: new Date(saved.endDate).toISOString(),
  };
  if (!isTaskCalendarEvent(event)) {
    throw new Error(
      'El calendario devolvió un resultado inválido. Revisá la app Calendario.',
    );
  }
  return event;
}

export async function readDeviceCalendarEvent(
  eventId: string,
  requestAccess: boolean,
  isCurrent: () => boolean,
): Promise<TaskCalendarEvent | null | undefined> {
  const calendar = await authorize(requestAccess);
  if (!isCurrent()) {
    return undefined;
  }
  if (typeof calendar.getEvent !== 'function') {
    throw new CalendarError(
      'Actualizá la aplicación para consultar los eventos del calendario.',
    );
  }
  try {
    const saved = await calendar.getEvent(eventId);
    return saved === null ? null : toTaskEvent(saved);
  } catch (cause) {
    throw nativeError(cause);
  }
}

export async function deleteDeviceCalendarEvent(
  eventId: string,
  isCurrent: () => boolean,
): Promise<boolean> {
  const calendar = await authorize(true);
  if (!isCurrent()) {
    return false;
  }
  if (typeof calendar.deleteEvent !== 'function') {
    throw new CalendarError(
      'Actualizá la aplicación para eliminar eventos del calendario.',
    );
  }
  try {
    if (!(await calendar.deleteEvent(eventId))) {
      throw new Error(
        'No se pudo confirmar la eliminación del evento. Intentá nuevamente.',
      );
    }
    return true;
  } catch (cause) {
    throw nativeError(cause);
  }
}
