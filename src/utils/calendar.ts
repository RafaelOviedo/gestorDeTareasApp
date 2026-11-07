import type { CalendarEventDraft, TaskCalendarEvent } from '../types/task';

export const EVENT_DURATIONS = [30, 60, 120];

export function validateCalendarEvent(
  draft: CalendarEventDraft,
): string | null {
  if (!draft.calendarId.trim()) {
    return 'Elegí un calendario para el evento.';
  }
  if (!Number.isFinite(Date.parse(draft.startAt))) {
    return 'Elegí una fecha válida para el evento.';
  }
  if (Date.parse(draft.startAt) <= Date.now()) {
    return 'La fecha y hora del evento deben ser futuras.';
  }
  if (!EVENT_DURATIONS.includes(draft.durationMinutes)) {
    return 'Elegí una duración de 30, 60 o 120 minutos.';
  }
  return null;
}

export function isTaskCalendarEvent(
  value: unknown,
): value is TaskCalendarEvent {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const event = value as Partial<TaskCalendarEvent>;
  return (
    typeof event.eventId === 'string' &&
    event.eventId.trim().length > 0 &&
    typeof event.calendarId === 'string' &&
    event.calendarId.trim().length > 0 &&
    typeof event.calendarName === 'string' &&
    event.calendarName.trim().length > 0 &&
    typeof event.startAt === 'string' &&
    Number.isFinite(Date.parse(event.startAt)) &&
    typeof event.endAt === 'string' &&
    Number.isFinite(Date.parse(event.endAt)) &&
    Date.parse(event.endAt) > Date.parse(event.startAt)
  );
}

export function initialEventDate(reminderAt: string | null): Date {
  const reminder = reminderAt ? Date.parse(reminderAt) : NaN;
  return new Date(
    reminder > Date.now() + 60_000
      ? reminder
      : Math.ceil((Date.now() + 15 * 60_000) / 60_000) * 60_000,
  );
}
