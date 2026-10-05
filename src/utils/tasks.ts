import type { TaskDraft } from '../types/task';

export const MAX_TASK_TITLE_LENGTH = 120;
export const reminderOptions = [
  { label: 'Sin recordatorio', seconds: 0 },
  { label: '10 segundos', seconds: 10 },
  { label: '30 segundos', seconds: 30 },
  { label: '1 minuto', seconds: 60 },
  { label: '5 minutos', seconds: 300 },
];

export function validateTask(draft: TaskDraft): string | null {
  if (!draft.title.trim()) {
    return 'Ingresá un título para la tarea.';
  }
  if (draft.title.trim().length > MAX_TASK_TITLE_LENGTH) {
    return `El título no puede superar los ${MAX_TASK_TITLE_LENGTH} caracteres.`;
  }
  if (
    !reminderOptions.some(option => option.seconds === draft.reminderSeconds)
  ) {
    return 'Elegí una opción de recordatorio válida.';
  }
  return null;
}

export function formatReminderDate(value: string): string {
  return new Date(value).toLocaleString('es-AR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
}
