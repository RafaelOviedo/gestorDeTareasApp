import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import type { Task } from '../types/task';
import { formatReminderDate } from '../utils/tasks';
import { colors } from '../styles';

type Props = {
  task: Task;
  onDelete: () => void;
  onToggleCompleted: () => void;
  isUpdating?: boolean;
  disabled?: boolean;
  isDeleting?: boolean;
};

export default function TaskItem({
  task,
  onDelete,
  onToggleCompleted,
  isUpdating = false,
  disabled = false,
  isDeleting = false,
}: Props) {
  const busy = isDeleting || isUpdating;
  return (
    <View style={styles.card}>
      <Text style={[styles.title, task.completed && styles.completedTitle]}>
        {task.title}
      </Text>
      <Text style={styles.status}>
        {task.completed ? 'Completada' : 'Pendiente'}
      </Text>
      <Text style={styles.detail}>
        {task.reminderAt
          ? `Recordatorio: ${formatReminderDate(task.reminderAt)}`
          : 'Sin recordatorio'}
      </Text>
      {task.reminderAt && !task.notificationId ? (
        <Text style={styles.detail}>Sin notificación programada</Text>
      ) : null}
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`${
          task.completed ? 'Marcar como pendiente' : 'Completar tarea'
        }: ${task.title}`}
        accessibilityState={{ disabled: disabled || busy, busy: isUpdating }}
        disabled={disabled || busy}
        onPress={onToggleCompleted}
        style={[styles.completeButton, (disabled || busy) && styles.disabled]}
      >
        <Text style={styles.completeText}>
          {isUpdating
            ? 'Guardando…'
            : task.completed
            ? 'Marcar como pendiente'
            : 'Marcar como completada'}
        </Text>
      </TouchableOpacity>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel={`Eliminar tarea: ${task.title}`}
        accessibilityState={{
          disabled: disabled || busy,
          busy: isDeleting,
        }}
        disabled={disabled || busy}
        onPress={onDelete}
        style={[styles.deleteButton, (disabled || busy) && styles.disabled]}
      >
        <Text style={styles.deleteText}>
          {isDeleting ? 'Eliminando…' : 'Eliminar'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 16,
    padding: 18,
    marginBottom: 14,
  },
  title: {
    color: colors.text,
    fontSize: 19,
    fontWeight: '600',
    marginBottom: 8,
  },
  completedTitle: { textDecorationLine: 'line-through', color: colors.muted },
  status: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  completeButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: colors.soft,
  },
  completeText: { color: colors.primary, fontSize: 15, fontWeight: '600' },
  detail: {
    color: colors.muted,
    fontSize: 14,
    lineHeight: 21,
    marginBottom: 4,
  },
  deleteButton: {
    alignSelf: 'flex-start',
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 12,
    marginTop: 8,
    borderRadius: 8,
    backgroundColor: '#FFF0EE',
  },
  deleteText: { color: '#B42318', fontSize: 15, fontWeight: '600' },
  disabled: { opacity: 0.45 },
});
