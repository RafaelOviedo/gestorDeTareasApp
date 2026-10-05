import { fireEvent, render, screen } from '@testing-library/react-native';
import TaskItem from '../src/components/TaskItem';
import type { Task } from '../src/types/task';
import { formatReminderDate } from '../src/utils/tasks';

const task: Task = {
  id: '1',
  userId: 'user:ana',
  title: 'Repasar',
  completed: false,
  createdAt: '2026-10-03T15:00:00.000Z',
  reminderAt: null,
  notificationId: null,
};

test('muestra la tarea y responde a eliminar sin permitir dobles pulsaciones cuando está ocupado', () => {
  const onDelete = jest.fn();
  const { rerender } = render(
    <TaskItem onToggleCompleted={jest.fn()} task={task} onDelete={onDelete} />,
  );
  expect(screen.getByText('Repasar')).toBeVisible();
  expect(screen.getByText('Sin recordatorio')).toBeVisible();
  fireEvent.press(
    screen.getByRole('button', { name: 'Eliminar tarea: Repasar' }),
  );
  expect(onDelete).toHaveBeenCalledTimes(1);
  rerender(
    <TaskItem
      onToggleCompleted={jest.fn()}
      task={task}
      onDelete={onDelete}
      isDeleting
    />,
  );
  expect(screen.getByText('Eliminando…')).toBeVisible();
  fireEvent.press(
    screen.getByRole('button', { name: 'Eliminar tarea: Repasar' }),
  );
  expect(onDelete).toHaveBeenCalledTimes(1);
});

test('muestra la fecha guardada sin prometer una notificación programada', () => {
  const reminderAt = new Date(Date.now() + 60000).toISOString();
  render(
    <TaskItem
      onToggleCompleted={jest.fn()}
      task={{ ...task, reminderAt }}
      onDelete={jest.fn()}
    />,
  );
  expect(
    screen.getByText(`Recordatorio: ${formatReminderDate(reminderAt)}`),
  ).toBeVisible();
  expect(screen.getByText('Sin notificación programada')).toBeVisible();
});

test('permite completar y reabrir una tarea y bloquea ambas acciones mientras guarda', () => {
  const onToggleCompleted = jest.fn();
  const onDelete = jest.fn();
  const { rerender } = render(
    <TaskItem
      task={task}
      onDelete={onDelete}
      onToggleCompleted={onToggleCompleted}
    />,
  );
  expect(screen.getByText('Pendiente')).toBeVisible();
  fireEvent.press(
    screen.getByRole('button', { name: 'Completar tarea: Repasar' }),
  );
  expect(onToggleCompleted).toHaveBeenCalledTimes(1);
  rerender(
    <TaskItem
      task={{ ...task, completed: true }}
      onDelete={onDelete}
      onToggleCompleted={onToggleCompleted}
    />,
  );
  expect(screen.getByText('Completada')).toBeVisible();
  expect(screen.getByText('Repasar')).toHaveStyle({
    textDecorationLine: 'line-through',
  });
  fireEvent.press(
    screen.getByRole('button', { name: 'Marcar como pendiente: Repasar' }),
  );
  expect(onToggleCompleted).toHaveBeenCalledTimes(2);
  rerender(
    <TaskItem
      task={task}
      onDelete={onDelete}
      onToggleCompleted={onToggleCompleted}
      isUpdating
    />,
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Completar tarea: Repasar' }),
  );
  fireEvent.press(
    screen.getByRole('button', { name: 'Eliminar tarea: Repasar' }),
  );
  expect(onToggleCompleted).toHaveBeenCalledTimes(2);
  expect(onDelete).not.toHaveBeenCalled();
});
