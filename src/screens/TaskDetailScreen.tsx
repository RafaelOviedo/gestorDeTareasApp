import { useState } from 'react';
import { Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import { useAuth } from '../context/AuthContext';
import { useTasksStore } from '../stores/useTasksStore';
import { formatReminderDate } from '../utils/tasks';
import Screen from '../components/Screen';
import AppButton from '../components/AppButton';
import DevicePermissions from '../components/DevicePermissions';
import TaskPhotoEditor from '../components/TaskPhotoEditor';
import { styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'TaskDetail'>;

export default function TaskDetailScreen({ route, navigation }: Props) {
  const { user } = useAuth();
  const task = useTasksStore(state =>
    state.tasks.find(
      item => item.id === route.params.taskId && item.userId === user?.id,
    ),
  );
  const [showPermissions, setShowPermissions] = useState(false);

  if (!task) {
    return (
      <Screen>
        <Text style={styles.title}>Tarea no encontrada</Text>
        <Text style={styles.hint}>
          La tarea ya no está disponible en tu lista.
        </Text>
        <AppButton
          title="Volver a mis tareas"
          onPress={() => navigation.goBack()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text style={styles.title}>{task.title}</Text>
      <View style={styles.card}>
        <Text style={styles.label}>Estado</Text>
        <Text style={styles.hint}>
          {task.completed ? 'Completada' : 'Pendiente'}
        </Text>
        <Text style={styles.label}>Fecha de creación</Text>
        <Text style={styles.hint}>{formatReminderDate(task.createdAt)}</Text>
        <Text style={styles.label}>Recordatorio</Text>
        <Text style={styles.hint}>
          {task.reminderAt
            ? formatReminderDate(task.reminderAt)
            : 'Sin recordatorio'}
        </Text>
        {task.reminderAt ? (
          <Text style={styles.hint}>
            {task.completed
              ? 'Recordatorio cancelado'
              : task.notificationId
              ? 'Notificación solicitada para esa fecha'
              : 'Sin notificación programada'}
          </Text>
        ) : null}
      </View>
      <TaskPhotoEditor key={task.id} task={task} />
      <AppButton
        title={
          showPermissions
            ? 'Ocultar permisos del dispositivo'
            : 'Ver permisos del dispositivo'
        }
        variant="secondary"
        onPress={() => setShowPermissions(!showPermissions)}
      />
      {showPermissions ? <DevicePermissions /> : null}
      <AppButton
        title="Volver a mis tareas"
        variant="secondary"
        onPress={() => navigation.goBack()}
      />
    </Screen>
  );
}
