import { useCallback, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../types/navigation';
import type { Task } from '../types/task';
import { useAuth } from '../context/AuthContext';
import { deleteTask, getTasks, setTaskCompleted } from '../services/tasks';
import AppButton from '../components/AppButton';
import FormMessage from '../components/FormMessage';
import ReminderPermissionHelp from '../components/ReminderPermissionHelp';
import { ReminderPermissionError } from '../services/notifications';
import TaskItem from '../components/TaskItem';
import { colors, styles } from '../styles';

type Props = NativeStackScreenProps<RootStackParamList, 'Home'>;

export default function HomeScreen({ navigation }: Props) {
  const { user, signOut } = useAuth();
  const userId = user?.id;
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [permissionError, setPermissionError] =
    useState<ReminderPermissionError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const mutating = useRef(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const isMutating = deletingId !== null || updatingId !== null;
  const completedCount = tasks.filter(task => task.completed).length;
  const pendingCount = tasks.length - completedCount;

  const active = useRef(false);
  const loadSequence = useRef(0);

  const loadTasks = useCallback(async () => {
    if (!userId) {
      return;
    }
    const sequence = ++loadSequence.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      const saved = await getTasks(userId);
      if (active.current && sequence === loadSequence.current) {
        setTasks(saved);
      }
    } catch (cause) {
      if (active.current && sequence === loadSequence.current) {
        setLoadError(
          cause instanceof Error
            ? cause.message
            : 'No se pudieron cargar las tareas.',
        );
      }
    } finally {
      if (active.current && sequence === loadSequence.current) {
        setIsLoading(false);
      }
    }
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      active.current = true;
      loadTasks();
      return () => {
        active.current = false;
        // Ignora respuestas pendientes al salir o cambiar de pantalla.
        loadSequence.current += 1;
      };
    }, [loadTasks]),
  );

  function reload() {
    if (!mutating.current) {
      loadTasks();
    }
  }

  async function removeTask(task: Task) {
    if (!userId || mutating.current || isLoading) {
      return;
    }
    mutating.current = true;
    setDeletingId(task.id);
    setActionError(null);
    setPermissionError(null);
    try {
      await deleteTask(userId, task.id);
      // La lista cambia solo después de confirmar el guardado en AsyncStorage.
      setTasks(current => current.filter(item => item.id !== task.id));
    } catch (cause) {
      setPermissionError(
        cause instanceof ReminderPermissionError ? cause : null,
      );
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo eliminar la tarea.',
      );
    } finally {
      mutating.current = false;
      setDeletingId(null);
    }
  }

  async function toggleCompleted(task: Task) {
    if (!userId || mutating.current || isLoading) {
      return;
    }
    mutating.current = true;
    setUpdatingId(task.id);
    setActionError(null);
    setPermissionError(null);
    try {
      const updated = await setTaskCompleted(userId, task.id, !task.completed);
      setTasks(current =>
        current.map(item => (item.id === updated.id ? updated : item)),
      );
    } catch (cause) {
      setPermissionError(
        cause instanceof ReminderPermissionError ? cause : null,
      );
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo actualizar la tarea.',
      );
    } finally {
      mutating.current = false;
      setUpdatingId(null);
    }
  }

  function confirmDelete(task: Task) {
    Alert.alert('Eliminar tarea', `¿Querés eliminar «${task.title}»?`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Eliminar',
        style: 'destructive',
        onPress: () => {
          removeTask(task);
        },
      },
    ]);
  }

  return (
    <SafeAreaView
      style={localStyles.screen}
      edges={['left', 'right', 'bottom']}
    >
      <FlatList
        data={tasks}
        keyExtractor={task => task.id}
        contentContainerStyle={localStyles.content}
        refreshing={isLoading && tasks.length > 0}
        onRefresh={reload}
        ListHeaderComponent={
          <View>
            <Text style={styles.title}>Hola, {user?.username}.</Text>
            <Text style={styles.subtitle}>
              Un pendiente a la vez. Tus tareas quedan guardadas en este
              dispositivo.
            </Text>
            <AppButton
              title="Crear tarea"
              onPress={() => navigation.navigate('CreateTask')}
              disabled={isLoading || isMutating}
            />
            <FormMessage message={actionError} />
            <ReminderPermissionHelp
              error={permissionError}
              disabled={isMutating}
            />
            <FormMessage message={loadError} />
            {loadError ? (
              <AppButton
                title="Reintentar carga"
                variant="secondary"
                onPress={reload}
                disabled={isLoading || isMutating}
              />
            ) : null}
            {tasks.length > 0 ? (
              <Text style={styles.hint}>
                {pendingCount} {pendingCount === 1 ? 'pendiente' : 'pendientes'}{' '}
                · {completedCount}{' '}
                {completedCount === 1 ? 'completada' : 'completadas'}
              </Text>
            ) : null}
          </View>
        }
        renderItem={({ item }) => (
          <TaskItem
            task={item}
            onDelete={() => confirmDelete(item)}
            onToggleCompleted={() => {
              toggleCompleted(item);
            }}
            isUpdating={updatingId === item.id}
            disabled={isLoading || isMutating}
            isDeleting={deletingId === item.id}
          />
        )}
        ListEmptyComponent={
          isLoading ? (
            <ActivityIndicator
              accessibilityLabel="Cargando tareas"
              color={colors.primary}
              style={localStyles.loading}
            />
          ) : !loadError ? (
            <View style={styles.card}>
              <Text style={styles.emptyTitle}>Todavía no hay tareas</Text>
              <Text style={styles.hint}>
                Agregá tu primer pendiente con el botón Crear tarea.
              </Text>
            </View>
          ) : null
        }
        ListFooterComponent={
          <AppButton
            title="Cerrar sesión"
            variant="secondary"
            onPress={signOut}
            disabled={isMutating}
          />
        }
      />
    </SafeAreaView>
  );
}

const localStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: {
    flexGrow: 1,
    padding: 24,
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
  },
  loading: { marginVertical: 24 },
});
