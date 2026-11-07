import { Text, View } from 'react-native';
import type { Task } from '../types/task';
import { useTasksStore } from '../stores/useTasksStore';
import { formatReminderDate } from '../utils/tasks';
import { styles } from '../styles';
import AppButton from './AppButton';

export default function TaskCalendarSection({
  task,
  onCreate,
}: {
  task: Task;
  onCreate: () => void;
}) {
  const busy = useTasksStore(
    state => state.mutation !== null || state.isLoading,
  );
  const event = task.calendarEvent;
  return (
    <View style={styles.card}>
      <Text style={styles.label}>Evento en el calendario</Text>
      {event ? (
        <>
          <Text style={styles.label}>{event.calendarName}</Text>
          <Text style={styles.hint}>
            Inicio: {formatReminderDate(event.startAt)}
          </Text>
          <Text style={styles.hint}>
            Fin: {formatReminderDate(event.endAt)}
          </Text>
          <Text style={styles.hint}>
            Evento creado. Estos son los datos al guardarlo; para verlo,
            modificarlo o eliminarlo, abrí la app Calendario.
          </Text>
          <Text style={styles.hint}>
            Completar o eliminar la tarea conserva el evento en el calendario.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            Reservá un horario para realizar esta tarea.
          </Text>
          <AppButton
            title="Agregar al calendario"
            disabled={busy}
            onPress={onCreate}
          />
        </>
      )}
    </View>
  );
}
