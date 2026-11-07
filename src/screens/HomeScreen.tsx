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
import { useTasksStore } from '../stores/useTasksStore';
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
  const tasks = useTasksStore(state => state.tasks);
  const isLoading = useTasksStore(state => state.isLoading);
  const loadError = useTasksStore(state => state.loadError);
  const loadTasks = useTasksStore(state => state.loadTasks);
  const deleteTask = useTasksStore(state => state.deleteTask);
  const updateTask = useTasksStore(state => state.updateTask);
  const mutation = useTasksStore(state => state.mutation);
  const [permissionError, setPermissionError] =
    useState<ReminderPermissionError | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const deletingId = mutation?.type === 'delete' ? mutation.taskId : null;
  const updatingId = mutation?.type === 'update' ? mutation.taskId : null;
  const signingOut = useRef(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const isMutating = mutation !== null || isSigningOut;
  const completedCount = tasks.filter(task => task.completed).length;
  const pendingCount = tasks.length - completedCount;

  useFocusEffect(
    useCallback(() => {
      loadTasks();
    }, [loadTasks]),
  );

  function reload() {
    if (!signingOut.current) {
      loadTasks();
    }
  }

  async function removeTask(task: Task) {
    if (!userId || task.userId !== userId || signingOut.current || isLoading) {
      return;
    }
    setActionError(null);
    setPermissionError(null);
    try {
      await deleteTask(task.id);
    } catch (cause) {
      setPermissionError(
        cause instanceof ReminderPermissionError ? cause : null,
      );
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo eliminar la tarea.',
      );
    }
  }

  async function toggleCompleted(task: Task) {
    if (!userId || task.userId !== userId || signingOut.current || isLoading) {
      return;
    }
    setActionError(null);
    setPermissionError(null);
    try {
      await updateTask(task.id, { completed: !task.completed });
    } catch (cause) {
      setPermissionError(
        cause instanceof ReminderPermissionError ? cause : null,
      );
      setActionError(
        cause instanceof Error
          ? cause.message
          : 'No se pudo actualizar la tarea.',
      );
    }
  }

  async function handleSignOut() {
    if (signingOut.current || useTasksStore.getState().mutation) {
      return;
    }
    signingOut.current = true;
    setIsSigningOut(true);
    setActionError(null);
    setPermissionError(null);
    try {
      await signOut();
    } catch (cause) {
      setActionError(
        cause instanceof Error ? cause.message : 'No se pudo cerrar la sesión.',
      );
    } finally {
      signingOut.current = false;
      setIsSigningOut(false);
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
            title={isSigningOut ? 'Cerrando sesión…' : 'Cerrar sesión'}
            variant="secondary"
            onPress={handleSignOut}
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
