import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  cancelReminder,
  prepareReminder,
  reminderId,
  scheduleReminder,
} from './notifications';
import type { Task, TaskDraft } from '../types/task';
import { MAX_TASK_TITLE_LENGTH, validateTask } from '../utils/tasks';

export function tasksStorageKey(userId: string): string {
  if (!userId.trim()) {
    throw new Error('Iniciá sesión para administrar tus tareas.');
  }
  return `@gestorDeTareas/tasks:v1:${userId}`;
}

function isDate(value: unknown): value is string {
  return typeof value === 'string' && Number.isFinite(Date.parse(value));
}

// Las tareas guardadas antes de incorporar estados no tienen completed.
type StoredTask = Omit<Task, 'completed'> & { completed?: boolean };

function isTask(value: unknown, userId: string): value is StoredTask {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const task = value as Partial<Task>;
  return (
    typeof task.id === 'string' &&
    task.id.trim().length > 0 &&
    task.userId === userId &&
    typeof task.title === 'string' &&
    task.title.trim().length > 0 &&
    task.title.length <= MAX_TASK_TITLE_LENGTH &&
    (task.completed === undefined || typeof task.completed === 'boolean') &&
    isDate(task.createdAt) &&
    (task.reminderAt === null || isDate(task.reminderAt)) &&
    (task.notificationId === null || typeof task.notificationId === 'string')
  );
}

async function readTasks(userId: string): Promise<Task[]> {
  const key = tasksStorageKey(userId);
  let raw: string | null;
  try {
    raw = await AsyncStorage.getItem(key);
  } catch {
    throw new Error('No se pudieron cargar las tareas. Intentá nuevamente.');
  }
  if (raw === null) {
    return [];
  }
  try {
    const tasks: unknown = JSON.parse(raw);
    if (!Array.isArray(tasks) || !tasks.every(task => isTask(task, userId))) {
      throw new Error('Invalid task data');
    }
    if (new Set(tasks.map(task => task.id)).size !== tasks.length) {
      throw new Error('Duplicate task identifiers');
    }
    return tasks.map(task => ({ ...task, completed: task.completed ?? false }));
  } catch {
    // Nunca reemplazar datos dañados por una lista vacía.
    throw new Error(
      'Las tareas guardadas tienen un formato inválido. No se modificaron los datos.',
    );
  }
}

// Serializa las escrituras de un usuario para evitar pérdidas si se guarda o elimina a la vez.
const pendingWrites = new Map<string, Promise<void>>();
function withTaskWrite<T>(
  userId: string,
  operation: () => Promise<T>,
): Promise<T> {
  tasksStorageKey(userId);
  const previous = pendingWrites.get(userId) ?? Promise.resolve();
  const result = previous.then(operation);
  const settled = result.then(
    () => {},
    () => {},
  );
  pendingWrites.set(userId, settled);
  settled.then(() => {
    if (pendingWrites.get(userId) === settled) {
      pendingWrites.delete(userId);
    }
  });
  return result;
}

export async function getTasks(userId: string): Promise<Task[]> {
  await pendingWrites.get(userId);
  return readTasks(userId);
}

// AsyncStorage y el sistema de notificaciones no comparten una transacción.
// Si falla el guardado, deshacemos el cambio nativo antes de devolver el error.
async function commitTaskChange(
  userId: string,
  nextTasks: Task[],
  previous: Task | null,
  next: Task | null,
  storageError: string,
): Promise<void> {
  const cancelledId = previous?.notificationId ?? null;
  const scheduledId = next?.notificationId ?? null;
  if (cancelledId && cancelledId !== scheduledId) {
    await cancelReminder(cancelledId);
  }
  if (scheduledId && scheduledId !== cancelledId && next) {
    try {
      await scheduleReminder(next);
    } catch (cause) {
      // El identificador determinista permite limpiar también un fallo nativo parcial.
      await cancelReminder(scheduledId);
      throw cause;
    }
  }
  try {
    await AsyncStorage.setItem(
      tasksStorageKey(userId),
      JSON.stringify(nextTasks),
    );
  } catch {
    try {
      if (scheduledId && scheduledId !== cancelledId) {
        await cancelReminder(scheduledId);
      }
      if (
        cancelledId &&
        cancelledId !== scheduledId &&
        previous?.reminderAt &&
        !previous.completed &&
        Date.parse(previous.reminderAt) > Date.now()
      ) {
        await scheduleReminder(previous);
      }
    } catch {
      throw new Error(
        `${storageError} Además, no se pudo restaurar el recordatorio; revisá la tarea e intentá nuevamente.`,
      );
    }
    throw new Error(storageError);
  }
}

export async function addTask(userId: string, draft: TaskDraft): Promise<Task> {
  const error = validateTask(draft);
  if (error) {
    throw new Error(error);
  }
  return withTaskWrite(userId, async () => {
    const tasks = await readTasks(userId);
    if (draft.reminderSeconds > 0) {
      await prepareReminder();
    }
    const now = Date.now();
    let id = `${now}-${Math.random().toString(36).slice(2, 10)}`;
    while (tasks.some(task => task.id === id)) {
      id += '-1';
    }
    const task: Task = {
      id,
      userId,
      title: draft.title.trim(),
      completed: false,
      createdAt: new Date(now).toISOString(),
      reminderAt:
        draft.reminderSeconds === 0
          ? null
          : new Date(now + draft.reminderSeconds * 1000).toISOString(),
      notificationId: null,
    };
    if (task.reminderAt) {
      task.notificationId = reminderId(task);
    }
    await commitTaskChange(
      userId,
      [task, ...tasks],
      null,
      task,
      'No se pudo guardar la tarea. Intentá nuevamente.',
    );
    return task;
  });
}

export async function deleteTask(
  userId: string,
  taskId: string,
): Promise<void> {
  return withTaskWrite(userId, async () => {
    const tasks = await readTasks(userId);
    const task = tasks.find(item => item.id === taskId);
    if (!task) {
      throw new Error('No se encontró esa tarea entre tus tareas.');
    }
    await commitTaskChange(
      userId,
      tasks.filter(item => item.id !== taskId),
      task,
      null,
      'No se pudo eliminar la tarea. Intentá nuevamente.',
    );
  });
}

export async function setTaskCompleted(
  userId: string,
  taskId: string,
  completed: boolean,
): Promise<Task> {
  return withTaskWrite(userId, async () => {
    const tasks = await readTasks(userId);
    const task = tasks.find(item => item.id === taskId);
    if (!task) {
      throw new Error('No se encontró esa tarea entre tus tareas.');
    }
    if (task.completed === completed) {
      return task;
    }
    const updated: Task = { ...task, completed, notificationId: null };
    if (
      !completed &&
      task.reminderAt &&
      Date.parse(task.reminderAt) > Date.now()
    ) {
      await prepareReminder();
      // El usuario pudo tardar en responder al permiso. Nunca programar fechas pasadas.
      if (Date.parse(task.reminderAt) > Date.now()) {
        updated.notificationId = reminderId(updated);
      }
    }
    await commitTaskChange(
      userId,
      tasks.map(item => (item.id === taskId ? updated : item)),
      task,
      updated,
      'No se pudo actualizar la tarea. Intentá nuevamente.',
    );
    return updated;
  });
}
