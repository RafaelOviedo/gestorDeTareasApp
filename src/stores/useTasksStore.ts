import { create } from 'zustand';
import * as taskService from '../services/tasks';
import type { Task, TaskDraft } from '../types/task';
import { pickTaskImage, type ImageSource } from '../services/taskImages';
import { getTaskLocation } from '../services/taskLocation';
import { getDeviceContact } from '../services/taskContacts';

type Mutation = { type: 'create' | 'update' | 'delete'; taskId: string | null };

type TasksStore = {
  userId: string | null;
  tasks: Task[];
  isLoading: boolean;
  loadError: string | null;
  mutation: Mutation | null;
  setOwner: (userId: string | null) => void;
  loadTasks: () => Promise<void>;
  addTask: (draft: TaskDraft) => Promise<boolean>;
  updateTask: (
    taskId: string,
    changes: Pick<Task, 'completed'>,
  ) => Promise<boolean>;
  deleteTask: (taskId: string) => Promise<boolean>;
  attachImage: (taskId: string, source: ImageSource) => Promise<boolean>;
  removeImage: (taskId: string) => Promise<boolean>;
  captureLocation: (taskId: string) => Promise<boolean>;
  removeLocation: (taskId: string) => Promise<boolean>;
  attachContact: (taskId: string, recordId: string) => Promise<boolean>;
  removeContact: (taskId: string) => Promise<boolean>;
};

export const useTasksStore = create<TasksStore>()((set, get) => {
  // Una nueva sesión invalida respuestas anteriores, incluso si vuelve el mismo usuario.
  let ownerVersion = 0;
  let loadSequence = 0;

  async function mutate(
    mutation: Mutation,
    execute: (userId: string) => Promise<Task | void>,
  ): Promise<boolean> {
    const { userId, isLoading, mutation: pending } = get();
    if (!userId) {
      throw new Error('Iniciá sesión para administrar tus tareas.');
    }
    // Bloquea operaciones repetidas antes de que React vuelva a renderizar.
    if (pending || isLoading) {
      return false;
    }
    const version = ownerVersion;
    set({ mutation });
    try {
      const saved = await execute(userId);
      if (version !== ownerVersion) {
        return false;
      }
      // Solo publicar cambios confirmados por almacenamiento y notificaciones.
      set(state => ({
        tasks:
          mutation.type === 'delete'
            ? state.tasks.filter(task => task.id !== mutation.taskId)
            : saved
            ? mutation.type === 'create'
              ? [saved, ...state.tasks]
              : state.tasks.map(task => (task.id === saved.id ? saved : task))
            : state.tasks,
      }));
      return saved !== undefined || mutation.type === 'delete';
    } catch (cause) {
      if (version === ownerVersion) {
        // La pantalla conserva el error original, incluidos los de permisos.
        throw cause;
      }
      return false;
    } finally {
      if (version === ownerVersion) {
        set({ mutation: null });
      }
    }
  }

  return {
    userId: null,
    tasks: [],
    isLoading: false,
    loadError: null,
    mutation: null,

    setOwner: userId => {
      ownerVersion += 1;
      loadSequence += 1;
      set({
        userId,
        tasks: [],
        isLoading: false,
        loadError: null,
        mutation: null,
      });
    },

    loadTasks: async () => {
      const { userId, mutation } = get();
      if (!userId || mutation) {
        return;
      }
      const version = ownerVersion;
      const sequence = ++loadSequence;
      const isCurrent = () =>
        version === ownerVersion && sequence === loadSequence;
      set({ isLoading: true, loadError: null });
      try {
        const tasks = await taskService.getTasks(userId);
        if (isCurrent()) {
          set({ tasks });
        }
      } catch (cause) {
        if (isCurrent()) {
          set({
            loadError:
              cause instanceof Error
                ? cause.message
                : 'No se pudieron cargar las tareas.',
          });
        }
      } finally {
        if (isCurrent()) {
          set({ isLoading: false });
        }
      }
    },

    addTask: draft =>
      mutate({ type: 'create', taskId: null }, userId =>
        taskService.addTask(userId, draft),
      ),
    updateTask: (taskId, changes) =>
      mutate({ type: 'update', taskId }, userId =>
        taskService.setTaskCompleted(userId, taskId, changes.completed),
      ),
    deleteTask: taskId =>
      mutate({ type: 'delete', taskId }, userId =>
        taskService.deleteTask(userId, taskId),
      ),
    attachImage: (taskId, source) => {
      const version = ownerVersion;
      return mutate({ type: 'update', taskId }, async userId => {
        if (
          !get().tasks.some(
            task => task.id === taskId && task.userId === userId,
          )
        ) {
          throw new Error('No se encontró esa tarea entre tus tareas.');
        }
        const image = await pickTaskImage(source);
        if (!image || version !== ownerVersion) {
          return;
        }
        return taskService.setTaskImage(userId, taskId, image);
      });
    },
    removeImage: taskId =>
      mutate({ type: 'update', taskId }, userId =>
        taskService.setTaskImage(userId, taskId, null),
      ),
    captureLocation: taskId => {
      const version = ownerVersion;
      return mutate({ type: 'update', taskId }, async userId => {
        if (
          !get().tasks.some(
            task => task.id === taskId && task.userId === userId,
          )
        ) {
          throw new Error('No se encontró esa tarea entre tus tareas.');
        }
        const location = await getTaskLocation();
        if (version !== ownerVersion) {
          return;
        }
        return taskService.setTaskLocation(userId, taskId, location);
      });
    },
    attachContact: (taskId, recordId) => {
      const version = ownerVersion;
      return mutate({ type: 'update', taskId }, async userId => {
        if (
          !get().tasks.some(
            task => task.id === taskId && task.userId === userId,
          )
        ) {
          throw new Error('No se encontró esa tarea entre tus tareas.');
        }
        const contact = await getDeviceContact(recordId);
        if (version !== ownerVersion) {
          return;
        }
        return taskService.setTaskContact(userId, taskId, contact);
      });
    },
    removeContact: taskId =>
      mutate({ type: 'update', taskId }, userId =>
        taskService.setTaskContact(userId, taskId, null),
      ),
    removeLocation: taskId =>
      mutate({ type: 'update', taskId }, userId =>
        taskService.setTaskLocation(userId, taskId, null),
      ),
  };
});
